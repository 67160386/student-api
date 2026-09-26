const app = require("./app");
const request = require("supertest");
const { redisClient } = require("./cache");
const pool = require("./db");
const { generateToken } = require("./auth-helpers");

// เชื่อมต่อ Redis ก่อนเริ่มรันเทสต์ทั้งหมดในไฟล์นี้
beforeAll(async () => {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
});

// ปิดการเชื่อมต่อ Redis เมื่อรันเทสต์เสร็จทั้งหมด เพื่อให้ Jest จบการทำงานได้สมบูรณ์
afterAll(async () => {
  if (redisClient.isOpen) {
    await redisClient.quit();
  }
});

describe("GET /", () => {
  test("ควรคืนค่า 200 เมื่อมีการเปิดเซิฟเวอร์สำเร็จ", async () => {
    const response = await request(app).get("/");
    expect(response.status).toBe(200);
  });
});

describe("GET /api/v1/students", () => {
  test("ควรคืนค่า 200 เมื่อมีการดึงข้อมูลถูกต้อง", async () => {
    const response = await request(app).get("/api/v1/students");
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
  });

  test("ควรคืนค่า 404 เมื่อมีใส่เส้นทางที่ไม่ถูกต้อง", async () => {
    const response = await request(app).get("/api/v1/wrongPath");
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("ROUTE_NOT_FOUND");
  });

  test("ควรคืนค่า 200 เมื่อมีการดึงข้อมูล id นักเรียนถูกต้อง", async () => {
    const id = 1;

    const response = await request(app).get(`/api/v1/students/${id}`);
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
  });

  test("ควรคืนค่า 404 เมื่อมีการดึงข้อมูล id นักเรียนไม่ถูกต้อง", async () => {
    const id = 999;

    const response = await request(app).get(`/api/v1/students/${id}`);
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  test("ควรคืนค่า 200 และดึงข้อมูลเฉพาะสาขาที่ระบุเมื่อส่ง query parameter 'major'", async () => {
    const majorToSearch = "เทคโนโลยีสารสนเทศ";

    const response = await request(app)
      .get("/api/v1/students")
      .query({ major: majorToSearch });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("สำเร็จ");
    expect(response.body).toHaveProperty("data");
  });
});

describe("GET /api/v1/students/:id", () => {
  test("ควรคืนค่า 200 เมื่อมีการดึงข้อมูล id นักเรียนถูกต้อง", async () => {
    const id = 1;

    const response = await request(app).get(`/api/v1/students/${id}`);
    expect(response.status).toBe(200);
  });

  test("ควรคืนค่า 404 เมื่อมีการดึงข้อมูล id นักเรียนไม่ถูกต้อง", async () => {
    const id = 999;

    const response = await request(app).get(`/api/v1/students/${id}`);
    expect(response.status).toBe(404);
  });
});

describe("GET /api/v1/students/:id/courses", () => {
  test("ควรคืนค่า 404 เมื่อไม่พบข้อมูลนักศึกษา", async () => {
    const dummyId = 999;

    const response = await request(app).get(
      `/api/v1/students/${dummyId}/courses`,
    );

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
    expect(response.body.error.message).toBe("ไม่พบข้อมูลนักศึกษา");
  });

  test("ควรคืนค่า 200 พร้อมข้อความแจ้งเตือน เมื่อนักศึกษายังไม่ได้ลงทะเบียนวิชาใดๆ", async () => {
    const uniqueEmail = `student${Date.now()}@example.com`;

    await request(app)
      .post("/api/v1/students")
      .send({ name: "สมชาย", major: "เทคโนโลยีสารสนเทศ", email: uniqueEmail });

    const newStudentId = 3;

    const response = await request(app).get(
      `/api/v1/students/${newStudentId}/courses`,
    );

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("นักศึกษายังไม่ได้ลงทะเบียนวิชาใดๆ");
    expect(response.body.data).toEqual([]);
  });

  test("ควรคืนค่า 200 พร้อมข้อมูลวิชาเรียน เมื่อนักศึกษามีการลงทะเบียนแล้ว", async () => {
    const enrolledStudentId = 1;

    const response = await request(app).get(
      `/api/v1/students/${enrolledStudentId}/courses`,
    );

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("สำเร็จ");
    expect(response.body.data.length).toBeGreaterThan(0);
  });

  test("ควรเข้า catch และคืนค่า 500 เมื่อเกิดข้อผิดพลาดกับฐานข้อมูล", async () => {
    const spy = jest
      .spyOn(pool, "query")
      .mockRejectedValue(new Error("Database connection lost"));

    const response = await request(app).get("/api/v1/students/1/courses");

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_ERROR");

    spy.mockRestore();
  });
});

describe("POST /api/v1/students", () => {
  test("ควรคืนค่า 400 เมื่อระบุข้อมูลนักศึกษาไม่ครบถ้วน", async () => {
    const response = await request(app)
      .post("/api/v1/students")
      .send({ name: "สมชาย", major: "เทคโนโลยีสารสนเทศ" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  test("ควรคืนค่า 201 เมื่อข้อมูลถูกต้องและครบถ้วน", async () => {
    const uniqueEmail = `student${Date.now()}@example.com`;

    const response = await request(app)
      .post("/api/v1/students")
      .send({ name: "สมชาย", major: "เทคโนโลยีสารสนเทศ", email: uniqueEmail });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe("เพิ่มข้อมูลสำเร็จ");
    expect(response.body.data).toHaveProperty("id");
  });

  test("ควรคืนค่า 409 เมื่อพยายามเพิ่มข้อมูลด้วยอีเมลที่ซ้ำในระบบ", async () => {
    const duplicateEmail = "duplicate@example.com";

    await request(app).post("/api/v1/students").send({
      name: "สมชาย",
      major: "เทคโนโลยีสารสนเทศ",
      email: duplicateEmail,
    });

    const response = await request(app).post("/api/v1/students").send({
      name: "สมศรี",
      major: "วิทยาการคอมพิวเตอร์",
      email: duplicateEmail,
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("DUPLICATE_EMAIL");
  });

  test("ควรเข้า catch และคืนค่า 500 เมื่อเกิดข้อผิดพลาดกับฐานข้อมูล", async () => {
    const spy = jest
      .spyOn(pool, "query")
      .mockRejectedValue(new Error("Database offline"));

    const response = await request(app).post("/api/v1/students").send({
      name: "สมชาย",
      major: "เทคโนโลยีสารสนเทศ",
      email: "error@example.com",
    });

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_ERROR");

    spy.mockRestore();
  });
});

describe("PUT /api/v1/students/:id", () => {
  test("ควรคืนค่า 404 เมื่อไม่พบข้อมูลนักศึกษา", async () => {
    const id = 999;

    const response = await request(app).put(`/api/v1/students/${id}`).send({
      name: "สมชาย",
      major: "เทคโนโลยีสารสนเทศ",
      email: "test@example.com",
    });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  test("ควรคืนค่า 400 เมื่อระบุข้อมูลไม่ครบถ้วน", async () => {
    const id = 1;

    const response = await request(app)
      .put(`/api/v1/students/${id}`)
      .send({ name: "สมชาย", major: "เทคโนโลยีสารสนเทศ" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("BAD_REQUEST");
  });

  test("ควรคืนค่า 200 เมื่อแก้ไขข้อมูลสำเร็จ", async () => {
    const id = 1;

    const response = await request(app).put(`/api/v1/students/${id}`).send({
      name: "สมชาย แก้ไข",
      major: "วิทยาการคอมพิวเตอร์",
      email: "update@example.com",
    });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("แก้ไขข้อมูลสำเร็จ");
  });
});

describe("PATCH /api/v1/students/:id", () => {
  test("ควรคืนค่า 404 เมื่อไม่พบข้อมูลนักศึกษา", async () => {
    const id = 999;

    const response = await request(app)
      .patch(`/api/v1/students/${id}`)
      .send({ name: "สมชาย" });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  test("ควรแก้ไขข้อมูลเฉพาะฟิลด์ name และคงค่าอื่นไว้", async () => {
    const id = 1;

    const response = await request(app)
      .patch(`/api/v1/students/${id}`)
      .send({ name: "สมชาย แก้ไข" });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("แก้ไขข้อมูลสำเร็จ");
  });

  test("ควรแก้ไขข้อมูลเฉพาะฟิลด์ major และ email", async () => {
    const id = 1;

    const response = await request(app)
      .patch(`/api/v1/students/${id}`)
      .send({ major: "CS", email: "new@example.com" });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("แก้ไขข้อมูลสำเร็จ");
  });
});

describe("DELETE /api/v1/students/:id", () => {
  let adminToken;
  let querySpy;

  beforeAll(() => {
    adminToken = generateToken({
      id: 1,
      email: "admin@test.com",
      role: "admin",
    });
  });

  beforeEach(() => {
    querySpy = jest.spyOn(pool, "query");
  });

  afterEach(() => {
    querySpy.mockRestore();
  });

  test("ควรคืนค่า 404 เมื่อไม่พบข้อมูลนักศึกษาที่ต้องการลบ", async () => {
    querySpy.mockResolvedValueOnce([{ affectedRows: 0 }]);

    const response = await request(app)
      .delete("/api/v1/students/999")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  test("ควรคืนค่า 200 เมื่อลบข้อมูลสำเร็จ", async () => {
    querySpy.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const response = await request(app)
      .delete("/api/v1/students/1")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("ลบข้อมูลสำเร็จ");
  });

  test("ควรเข้า catch และคืนค่า 500 เมื่อเกิดข้อผิดพลาดกับฐานข้อมูล", async () => {
    querySpy.mockRejectedValue(new Error("Database connection lost"));

    const response = await request(app)
      .delete("/api/v1/students/1")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_ERROR");
  });
});

describe("POST /api/v1/students/:id/enrollments", () => {
  let mockConnection;
  let getConnectionSpy;

  beforeEach(() => {
    mockConnection = {
      beginTransaction: jest.fn(),
      query: jest.fn(),
      rollback: jest.fn(),
      commit: jest.fn(),
      release: jest.fn(),
    };
    getConnectionSpy = jest
      .spyOn(pool, "getConnection")
      .mockResolvedValue(mockConnection);
  });

  afterEach(() => {
    getConnectionSpy.mockRestore();
  });

  test("ควรคืนค่า 404 เมื่อรายวิชาที่ระบุไม่มีในระบบ", async () => {
    mockConnection.query.mockResolvedValue([[]]);

    const response = await request(app)
      .post("/api/v1/students/1/enrollments")
      .send({ courseId: 99 });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("COURSE_NOT_FOUND");
    expect(mockConnection.rollback).toHaveBeenCalled();
  });

  test("ควรคืนค่า 409 เมื่อที่นั่งเต็ม", async () => {
    mockConnection.query.mockResolvedValue([[{ seat_available: 0 }]]);

    const response = await request(app)
      .post("/api/v1/students/1/enrollments")
      .send({ courseId: 1 });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("SEAT_FULL");
    expect(mockConnection.rollback).toHaveBeenCalled();
  });

  test("ควรคืนค่า 201 เมื่อลงทะเบียนสำเร็จ", async () => {
    mockConnection.query
      .mockResolvedValueOnce([[{ seat_available: 10 }]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}]);

    const response = await request(app)
      .post("/api/v1/students/1/enrollments")
      .send({ courseId: 1 });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe("ลงทะเบียนสำเร็จ");
    expect(mockConnection.commit).toHaveBeenCalled();
  });

  test("ควรคืนค่า 409 เมื่อนักศึกษาลงทะเบียนรายวิชานี้ซ้ำ", async () => {
    const duplicateError = new Error("Duplicate entry");
    duplicateError.code = "ER_DUP_ENTRY";

    mockConnection.query
      .mockResolvedValueOnce([[{ seat_available: 10 }]])
      .mockRejectedValueOnce(duplicateError);

    const response = await request(app)
      .post("/api/v1/students/1/enrollments")
      .send({ courseId: 1 });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("ALREADY_ENROLLED");
    expect(mockConnection.rollback).toHaveBeenCalled();
  });

  test("ควรคืนค่า 500 เมื่อเกิดข้อผิดพลาดกับฐานข้อมูล", async () => {
    mockConnection.query.mockRejectedValue(new Error("Connection lost"));

    const response = await request(app)
      .post("/api/v1/students/1/enrollments")
      .send({ courseId: 1 });

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_ERROR");
    expect(mockConnection.rollback).toHaveBeenCalled();
  });
});

describe("POST /api/v1/students/:id/enrollments-unsafe", () => {
  let querySpy;

  beforeEach(() => {
    querySpy = jest.spyOn(pool, "query");
  });

  afterEach(() => {
    querySpy.mockRestore();
  });

  test("ควรคืนค่า 404 เมื่อรายวิชาที่ระบุไม่มีในระบบ", async () => {
    querySpy.mockResolvedValueOnce([[]]);

    const response = await request(app)
      .post("/api/v1/students/1/enrollments-unsafe")
      .send({ courseId: 99 });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("COURSE_NOT_FOUND");
  });

  test("ควรคืนค่า 409 เมื่อที่นั่งเต็ม", async () => {
    querySpy.mockResolvedValueOnce([[{ seat_available: 0 }]]);

    const response = await request(app)
      .post("/api/v1/students/1/enrollments-unsafe")
      .send({ courseId: 1 });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("SEAT_FULL");
  });

  test("ควรคืนค่า 201 เมื่อลงทะเบียนสำเร็จ (Unsafe)", async () => {
    querySpy
      .mockResolvedValueOnce([[{ seat_available: 10 }]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}]);

    const response = await request(app)
      .post("/api/v1/students/1/enrollments-unsafe")
      .send({ courseId: 1 });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe("ลงทะเบียนสำเร็จ (Unsafe)");
  });

  test("ควรคืนค่า 409 เมื่อนักศึกษาลงทะเบียนรายวิชานี้ซ้ำ", async () => {
    const duplicateError = new Error("Duplicate entry");
    duplicateError.code = "ER_DUP_ENTRY";

    querySpy
      .mockResolvedValueOnce([[{ seat_available: 10 }]])
      .mockRejectedValueOnce(duplicateError);

    const response = await request(app)
      .post("/api/v1/students/1/enrollments-unsafe")
      .send({ courseId: 1 });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("ALREADY_ENROLLED");
  });

  test("ควรคืนค่า 500 เมื่อเกิดข้อผิดพลาดกับฐานข้อมูล", async () => {
    querySpy.mockRejectedValue(new Error("Database connection error"));

    const response = await request(app)
      .post("/api/v1/students/1/enrollments-unsafe")
      .send({ courseId: 1 });

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_ERROR");
  });
});

describe("DELETE /api/v1/students/:id/enrollments/:courseId", () => {
  let mockConnection;
  let getConnectionSpy;

  beforeEach(() => {
    mockConnection = {
      beginTransaction: jest.fn(),
      query: jest.fn(),
      rollback: jest.fn(),
      commit: jest.fn(),
      release: jest.fn(),
    };
    getConnectionSpy = jest
      .spyOn(pool, "getConnection")
      .mockResolvedValue(mockConnection);
  });

  afterEach(() => {
    getConnectionSpy.mockRestore();
  });

  test("ควรคืนค่า 404 เมื่อไม่พบข้อมูลการลงทะเบียนรายวิชานี้ของนักศึกษา", async () => {
    mockConnection.query.mockResolvedValueOnce([{ affectedRows: 0 }]);

    const response = await request(app).delete(
      "/api/v1/students/1/enrollments/1",
    );

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("ENROLLMENT_NOT_FOUND");
    expect(mockConnection.rollback).toHaveBeenCalled();
    expect(mockConnection.release).toHaveBeenCalled();
  });

  test("ควรคืนค่า 404 เมื่อไม่พบรายวิชาที่จะคืนจำนวนที่นั่ง", async () => {
    mockConnection.query
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 0 }]);

    const response = await request(app).delete(
      "/api/v1/students/1/enrollments/1",
    );

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("COURSE_NOT_FOUND");
    expect(mockConnection.rollback).toHaveBeenCalled();
  });

  test("ควรคืนค่า 200 เมื่อยกเลิกการลงทะเบียนสำเร็จ", async () => {
    mockConnection.query
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const response = await request(app).delete(
      "/api/v1/students/1/enrollments/1",
    );

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("ยกเลิกการลงทะเบียนสำเร็จ");
    expect(mockConnection.commit).toHaveBeenCalled();
  });

  test("ควรเข้า catch และคืนค่า 500 เมื่อเกิดข้อผิดพลาดกับฐานข้อมูล", async () => {
    mockConnection.query.mockRejectedValue(
      new Error("Database connection lost"),
    );

    const response = await request(app).delete(
      "/api/v1/students/1/enrollments/1",
    );

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_ERROR");
    expect(mockConnection.rollback).toHaveBeenCalled();
  });
});

describe("GET /api/v2/students (ระบบ Cache)", () => {
  beforeEach(async () => {
    if (redisClient.isOpen) {
      await redisClient.del("students:all");
    }
  });

  test("ควรคืนค่า 200 และดึงข้อมูลจากฐานข้อมูล (Cache Miss)", async () => {
    const response = await request(app).get("/api/v2/students");

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("สำเร็จ (จากฐานข้อมูล)");
    expect(response.body).toHaveProperty("data");
  });

  test("ควรคืนค่า 200 และดึงข้อมูลจากแคชเมื่อมีการเรียกซ้ำ (Cache Hit)", async () => {
    await request(app).get("/api/v2/students");

    const response = await request(app).get("/api/v2/students");

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("สำเร็จ (จาก cache)");
  });

  test("ควรเข้า catch และคืนค่า 500 เมื่อเกิดข้อผิดพลาดในการดึงข้อมูล", async () => {
    const spy = jest
      .spyOn(pool, "query")
      .mockRejectedValue(new Error("Database connection lost"));

    const response = await request(app).get("/api/v2/students");

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_ERROR");

    spy.mockRestore();
  });
});
