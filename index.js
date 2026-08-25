require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const { graphqlHTTP } = require("express-graphql");

const schema = require("./schema");
const root = require("./resolvers");

const app = express();
const PORT = process.env.PORT || 3000;

const pool = require("./db");

const {
  hashPassword,
  verifyPassword,
  generateToken,
} = require("./auth-helpers");
const { authenticateToken, authorizeRole } = require("./middlewares/auth");

// ลำดับ middleware มีความสำคัญ: security header → CORS → logger → body parser
app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  }),
);
app.use(morgan("dev"));
app.use(express.json({ limit: "10kb" }));

app.use(
  "/graphql",
  graphqlHTTP({
    schema: schema,
    rootValue: root,
    graphiql: true, // เปิดใช้งานหน้าทดสอบ GraphiQL ผ่านเบราว์เซอร์
  }),
);

app.get("/", (req, res) => {
  res.status(200).json({ message: "Student API พร้อมใช้งาน" });
});

// 1. GET: ดึงรายการนักศึกษาทั้งหมด
app.get("/api/v1/students", async (req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT * FROM students");
    res.status(200).json({ message: "สำเร็จ", data: rows });
  } catch (err) {
    next(err);
  }
});

// 2. GET: ดึงข้อมูลนักศึกษารายบุคคลตาม id
app.get("/api/v1/students/:id", async (req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT * FROM students WHERE id = ?", [
      req.params.id,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "ไม่พบข้อมูลนักศึกษา" },
      });
    }

    res.status(200).json({ message: "สำเร็จ", data: rows[0] });
  } catch (err) {
    next(err);
  }
});

// WK05 EXAM 1: เพิ่ม Endpoint ดึงข้อมูลแบบ JOIN
// 3. GET: ดึงชื่อรายวิชาทั้งหมดที่นักศึกษาคนนั้นลงทะเบียน
app.get("/api/v1/students/:id/courses", async (req, res, next) => {
  const studentId = req.params.id;

  try {
    const [studentRows] = await pool.query(
      "SELECT id FROM students WHERE id = ?",
      [studentId],
    );

    if (studentRows.length === 0) {
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "ไม่พบข้อมูลนักศึกษา" } });
    }

    const sql = `
      SELECT courses.* 
      FROM courses
      JOIN enrollments ON courses.id = enrollments.course_id
      WHERE enrollments.student_id = ?
    `;

    const [rows] = await pool.query(sql, [studentId]);

    const message =
      rows.length > 0 ? "สำเร็จ" : "นักศึกษายังไม่ได้ลงทะเบียนวิชาใดๆ";
    res.status(200).json({
      message,
      data: rows,
    });
  } catch (err) {
    next(err);
  }
});

// 4. GET: เฉพาะผู้ที่ล็อกอินแล้วเท่านั้นที่ดูข้อมูลของตนเองได้
app.get("/api/v1/auth/me", authenticateToken, (req, res) => {
  res.status(200).json({ message: "สำเร็จ", data: req.user });
});

// 5. POST: เพิ่มข้อมูลนักศึกษาใหม่
app.post("/api/v1/students", async (req, res, next) => {
  const { name, major, email } = req.body;

  if (!name || !major || !email) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "กรุณาระบุข้อมูลให้ครบถ้วน" },
    });
  }

  try {
    const [result] = await pool.query(
      "INSERT INTO students (name, major, email) VALUES (?, ?, ?)",
      [name, major, email],
    );
    res.status(201).json({
      message: "เพิ่มข้อมูลสำเร็จ",
      data: { id: result.insertId, name, major, email },
    });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        error: { code: "DUPLICATE_EMAIL", message: "อีเมลนี้มีอยู่ในระบบแล้ว" },
      });
    }
    next(err);
  }
});

// 6. POST: เพิ่มข้อมูลลงทะเบียนเรียนของนักศึกษา
app.post("/api/v1/students/:id/enrollments", async (req, res, next) => {
  const studentId = req.params.id;
  const { courseId } = req.body;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [courseRows] = await connection.query(
      "SELECT * FROM courses WHERE id = ? FOR UPDATE",
      [courseId],
    );

    if (courseRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        error: { code: "COURSE_NOT_FOUND", message: "ไม่พบรายวิชาที่ระบุ" },
      });
    }

    if (courseRows[0].seat_available <= 0) {
      await connection.rollback();
      return res.status(409).json({
        error: { code: "SEAT_FULL", message: "ที่นั่งเต็มแล้ว" },
      });
    }

    await connection.query(
      "INSERT INTO enrollments (student_id, course_id) VALUES (?, ?)",
      [studentId, courseId],
    );

    await connection.query(
      "UPDATE courses SET seat_available = seat_available - 1 WHERE id = ?",
      [courseId],
    );

    await connection.commit();
    res.status(201).json({ message: "ลงทะเบียนสำเร็จ" });
  } catch (err) {
    await connection.rollback();
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        error: {
          code: "ALREADY_ENROLLED",
          message: "นักศึกษาลงทะเบียนรายวิชานี้ไปแล้ว",
        },
      });
    }
    next(err);
  } finally {
    connection.release();
  }
});

// WK05 EXAM 2: ทดสอบผลกระทบเมื่อไม่ใช้ Transaction
// 7. POST: เพิ่มข้อมูลลงทะเบียนเรียนของนักศึกษา
app.post("/api/v1/students/:id/enrollments-unsafe", async (req, res, next) => {
  const studentId = req.params.id;
  const { courseId } = req.body;

  try {
    const [courseRows] = await pool.query(
      "SELECT * FROM courses WHERE id = ?",
      [courseId],
    );

    if (courseRows.length === 0) {
      return res.status(404).json({
        error: { code: "COURSE_NOT_FOUND", message: "ไม่พบรายวิชาที่ระบุ" },
      });
    }

    if (courseRows[0].seat_available <= 0) {
      return res.status(409).json({
        error: { code: "SEAT_FULL", message: "ที่นั่งเต็มแล้ว" },
      });
    }

    // ข้อมูลไม่สอดคล้องกัน คำสั่ง INSERT ทำงานเสร็จสิ้นและถูกบันทึกลงในตาราง enrollments ไปแล้ว แต่วิชาดังกล่าวในตาราง courses กลับไม่ได้ถูกตัดจำนวนที่นั่ง (seat_available) ออกไป
    await pool.query(
      "INSERT INTO enrollments (student_id, course_id) VALUES (?, ?)",
      [studentId, courseId],
    );

    // ปัญหาที่นั่งเกินจริง ระบบแสดงจำนวนที่นั่งว่างมากกว่าความเป็นจริง ทำให้นักศึกษาคนอื่นสามารถเข้ามาลงทะเบียนเกินโควตาที่เปิดรับได้
    await pool.query(
      "UPDATE courses SET seat_available = seat_available - 1 WHERE id = ?",
      [courseId],
    );

    res.status(201).json({ message: "ลงทะเบียนสำเร็จ (Unsafe)" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        error: {
          code: "ALREADY_ENROLLED",
          message: "นักศึกษาลงทะเบียนรายวิชานี้ไปแล้ว",
        },
      });
    }
    next(err);
  }
});

// 8. POST: สมัครสมาชิก
app.post("/api/v1/auth/register", async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "กรุณาระบุ email และ password",
      },
    });
  }

  try {
    const passwordHash = await hashPassword(password);
    const [result] = await pool.query(
      "INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'student')",
      [email, passwordHash],
    );

    res.status(201).json({
      message: "สมัครสมาชิกสำเร็จ",
      data: { id: result.insertId, email, role: "student" },
    });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        error: { code: "DUPLICATE_EMAIL", message: "อีเมลนี้มีอยู่ในระบบแล้ว" },
      });
    }
    next(err);
  }
});

// 9. POST: เข้าสู่ระบบ
app.post("/api/v1/auth/login", async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "กรุณาระบุ email และ password",
      },
    });
  }

  try {
    const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);

    if (rows.length === 0) {
      return res.status(401).json({
        error: {
          code: "INVALID_CREDENTIALS",
          message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
        },
      });
    }

    const user = rows[0];
    const isPasswordValid = await verifyPassword(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        error: {
          code: "INVALID_CREDENTIALS",
          message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
        },
      });
    }

    const token = generateToken(user);
    res.status(200).json({ message: "เข้าสู่ระบบสำเร็จ", token });
  } catch (err) {
    next(err);
  }
});

// 10. PUT: แก้ไขข้อมูลนักศึกษาทั้งระเบียน
app.put("/api/v1/students/:id", (req, res) => {
  const id = Number(req.params.id);
  const { name, major, email } = req.body;
  const student = students.find((s) => s.id === id);

  if (!student) {
    return res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "ไม่พบข้อมูลนักศึกษา" } });
  }

  if (!name || !major || !email) {
    return res.status(400).json({
      error: {
        code: "BAD_REQUEST",
        message: "กรุณาระบุ name, major และ email ให้ครบถ้วน",
      },
    });
  }

  student.name = name;
  student.major = major;
  student.email = email;

  res.status(200).json({ message: "แก้ไขข้อมูลสำเร็จ", data: student });
});

// 11. PATCH: แก้ไขข้อมูลนักศึกษา
app.patch("/api/v1/students/:id", (req, res) => {
  const id = Number(req.params.id);
  const student = students.find((s) => s.id === id);

  if (!student) {
    return res.status(404).json({
      error: { code: "NOT_FOUND", message: "ไม่พบข้อมูลนักศึกษา" },
    });
  }

  // อัปเดตเฉพาะฟิลด์ที่ส่งมา ฟิลด์อื่นคงค่าเดิมไว้
  const { name, major, email } = req.body;
  if (name !== undefined) student.name = name;
  if (major !== undefined) student.major = major;
  if (email !== undefined) student.email = email;

  res.status(200).json({ message: "แก้ไขข้อมูลสำเร็จ", data: student });
});

// 12. DELETE: ลบข้อมูลนักศึกษา
app.delete(
  "/api/v1/students/:id",
  authenticateToken,
  authorizeRole("admin"),
  async (req, res, next) => {
    try {
      const [result] = await pool.query("DELETE FROM students WHERE id = ?", [
        req.params.id,
      ]);
      if (result.affectedRows === 0) {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "ไม่พบข้อมูลนิสิต" },
        });
      }
      res.status(200).json({ message: "ลบข้อมูลสำเร็จ" });
    } catch (err) {
      next(err);
    }
  },
);

// WK05 EXAM 3: เพิ่ม Endpoint สำหรับยกเลิกการลงทะเบียน
// 13. DELETE: ลบข้อมูลนักศึกษา
app.delete(
  "/api/v1/students/:id/enrollments/:courseId",
  async (req, res, next) => {
    const { id: studentId, courseId } = req.params;
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [deleteResult] = await connection.query(
        "DELETE FROM enrollments WHERE student_id = ? AND course_id = ?",
        [studentId, courseId],
      );

      if (deleteResult.affectedRows === 0) {
        await connection.rollback();
        return res.status(404).json({
          error: {
            code: "ENROLLMENT_NOT_FOUND",
            message: "ไม่พบข้อมูลการลงทะเบียนรายวิชานี้ของนักศึกษา",
          },
        });
      }

      const [updateResult] = await connection.query(
        "UPDATE courses SET seat_available = seat_available + 1 WHERE id = ?",
        [courseId],
      );

      if (updateResult.affectedRows === 0) {
        await connection.rollback();
        return res.status(404).json({
          error: {
            code: "COURSE_NOT_FOUND",
            message: "ไม่พบรายวิชาที่ระบุ",
          },
        });
      }

      await connection.commit();
      res.status(200).json({ message: "ยกเลิกการลงทะเบียนสำเร็จ" });
    } catch (err) {
      await connection.rollback();
      next(err);
    } finally {
      connection.release();
    }
  },
);

// 404: ไม่พบ route ที่ร้องขอ (ต้องอยู่หลัง route ทั้งหมด)
app.use((req, res) => {
  res.status(404).json({
    error: { code: "ROUTE_NOT_FOUND", message: "ไม่พบเส้นทางที่ร้องขอ" },
  });
});

// Error-handling middleware (ต้องมีพารามิเตอร์ 4 ตัวเสมอ)
app.use((err, req, res, next) => {
  console.error(err.stack);
  // ใช้ err.status/err.statusCode หากมี (เช่น PayloadTooLargeError จาก express.json ที่ส่งมาเป็น 413)
  // เพื่อไม่ให้ error ที่มีรหัสสถานะของตัวเองถูกกลบด้วย 500 เสมอไป
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    error: {
      code: statusCode === 500 ? "INTERNAL_SERVER_ERROR" : err.type || "ERROR",
      message:
        statusCode === 500
          ? "เกิดข้อผิดพลาดที่ไม่คาดคิดภายในระบบ"
          : err.message,
    },
  });
});

app.listen(PORT, () => {
  console.log(`Server กำลังทำงานที่พอร์ต ${PORT} (${process.env.NODE_ENV})`);
});
