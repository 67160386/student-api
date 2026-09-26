const request = require("supertest");
const app = require("./app");

describe("POST /api/v1/auth/register", () => {
  test("ควรคืน 201 เมื่อข้อมูลถูกต้องและครบถ้วน", async () => {
    const uniqueEmail = `test${Date.now()}@example.com`;

    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: uniqueEmail, password: "Passw0rd!" });

    expect(response.status).toBe(201);
    expect(response.body.data).toHaveProperty("id");
    expect(response.body.data.role).toBe("student");
  });

  test("ควรคืน 400 เมื่อไม่ระบุ password", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "incomplete@example.com" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  test("ควรคืน 409 เมื่อ email ซ้ำกับที่มีอยู่แล้ว", async () => {
    const duplicateEmail = `dup${Date.now()}@example.com`;

    await request(app)
      .post("/api/v1/auth/register")
      .send({ email: duplicateEmail, password: "Passw0rd!" });

    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: duplicateEmail, password: "Passw0rd!" });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("DUPLICATE_EMAIL");
  });
});

describe("POST /api/v1/auth/login", () => {
  test("ควรคืน 401 เมื่อ email ไม่มีอยู่ในระบบ", async () => {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "notfound@example.com", password: "Passw0rd!" });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
  });
});

describe("GET /api/v1/auth/me", () => {
  test("ควรคืน 401 เมื่อไม่แนบ Authorization header", async () => {
    const response = await request(app).get("/api/v1/auth/me");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("NO_TOKEN");
  });

  test("ควรคืน 200 พร้อมข้อมูลผู้ใช้เมื่อแนบ token ที่ถูกต้อง", async () => {
    const uniqueEmail = `me${Date.now()}@example.com`;

    await request(app)
      .post("/api/v1/auth/register")
      .send({ email: uniqueEmail, password: "Passw0rd!" });

    const loginResponse = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: uniqueEmail, password: "Passw0rd!" });

    const token = loginResponse.body.token;

    const response = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.email).toBe(uniqueEmail);
  });
});
