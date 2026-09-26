jest.mock("./db");
const pool = require("./db");
const request = require("supertest");
const app = require("./app");
const { hashPassword } = require("./auth-helpers");

describe("POST /api/v1/auth/login (mocked database)", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("ควรคืน token เมื่อ email และ password ถูกต้อง", async () => {
    const hashedPassword = await hashPassword("Passw0rd!");

    pool.query.mockResolvedValueOnce([
      [
        {
          id: 1,
          email: "mocked@example.com",
          password_hash: hashedPassword,
          role: "student",
        },
      ],
    ]);

    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "mocked@example.com", password: "Passw0rd!" });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("token");
  });

  test("ควรคืน 401 เมื่อไม่พบผู้ใช้ในระบบ", async () => {
    pool.query.mockResolvedValueOnce([[]]);

    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "notfound@example.com", password: "Passw0rd!" });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  test("ควรคืน 500 เมื่อฐานข้อมูลเกิดข้อผิดพลาด", async () => {
    pool.query.mockRejectedValueOnce(new Error("Connection lost"));

    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "any@example.com", password: "Passw0rd!" });

    expect(response.status).toBe(500);
  });
});
