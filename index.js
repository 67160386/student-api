const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;
const { graphqlHTTP } = require("express-graphql");
const schema = require("./schema");
const root = require("./resolvers");

app.use(express.json());

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

let students = [
  {
    id: 1,
    name: "สมชาย ใจดี",
    major: "วิทยาการคอมพิวเตอร์",
    email: "somchai@example.com",
    phone: "080-000-0001",
    courseIds: [101, 102],
  },
  {
    id: 2,
    name: "สมหญิง รักเรียน",
    major: "เทคโนโลยีสารสนเทศ",
    email: "somying@example.com",
    phone: "080-000-0002",
    courseIds: [102],
  },
];

let courses = [
  { id: 101, courseName: "การเขียนโปรแกรมเบื้องต้น", credit: 3 },
  { id: 102, courseName: "โครงสร้างข้อมูล", credit: 3 },
];

let nextId = 3;

// 1. GET: ดึงรายการนักศึกษาทั้งหมด
app.get("/api/v1/students", (req, res) => {
  res.status(200).json({ message: "สำเร็จ", data: students });
});

// 2. GET: ดึงข้อมูลนักศึกษารายบุคคลตาม id
app.get("/api/v1/students/:id", (req, res) => {
  const id = Number(req.params.id);
  const student = students.find((s) => s.id === id);

  if (!student) {
    return res.status(404).json({
      error: { code: "NOT_FOUND", message: "ไม่พบข้อมูลนักศึกษา" },
    });
  }

  // "/api/v1/students/1?include=courses" รองรับการดึงรายวิชา
  const shouldIncludeCourses = req.query.include === "courses";

  if (shouldIncludeCourses) {
    const studentCourses = courses.filter((c) =>
      student.courseIds.includes(c.id),
    );
    return res.status(200).json({
      message: "สำเร็จ",
      data: { ...student, courses: studentCourses },
    });
  }

  res.status(200).json({ message: "สำเร็จ", data: student });
});

// 3. POST: เพิ่มข้อมูลนักศึกษาใหม่
app.post("/api/v1/students", (req, res) => {
  const { name, major, email } = req.body;

  if (!name || !major || !email) {
    return res
      .status(400)
      .json({ message: "กรุณาระบุ name, major และ email ให้ครบถ้วน" });
  }

  const duplicated = students.find((s) => s.email === email);
  if (duplicated) {
    return res.status(409).json({
      error: {
        code: "DUPLICATE_EMAIL",
        message: "อีเมลนี้มีอยู่ในระบบแล้ว",
      },
    });
  }

  const newStudent = { id: nextId++, name, major, email };
  students.push(newStudent);

  res.status(201).json({ message: "เพิ่มข้อมูลสำเร็จ", data: newStudent });
});

// 4. PUT: แก้ไขข้อมูลนักศึกษาทั้งระเบียน
app.put("/api/v1/students/:id", (req, res) => {
  const id = Number(req.params.id);
  const { name, major } = req.body;
  const student = students.find((s) => s.id === id);

  if (!student) {
    return res.status(404).json({ message: "ไม่พบข้อมูลนักศึกษา" });
  }

  if (!name || !major) {
    return res
      .status(400)
      .json({ message: "กรุณาระบุ name และ major ให้ครบถ้วน" });
  }

  student.name = name;
  student.major = major;

  res.status(200).json({ message: "แก้ไขข้อมูลสำเร็จ", data: student });
});

// 5. DELETE: ลบข้อมูลนักศึกษา
app.delete("/api/v1/students/:id", (req, res) => {
  const id = Number(req.params.id);
  const index = students.findIndex((s) => s.id === id);

  if (index === -1) {
    return res.status(404).json({ message: "ไม่พบข้อมูลนักศึกษา" });
  }

  students.splice(index, 1);

  res.status(200).json({ message: "ลบข้อมูลสำเร็จ" });
});

// 6. PATCH: แก้ไขข้อมูลนักศึกษา
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

app.listen(PORT, () => {
  console.log(`Server กำลังทำงานที่ http://localhost:${PORT}`);
});
