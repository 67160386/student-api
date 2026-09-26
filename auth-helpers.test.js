const {
  hashPassword,
  verifyPassword,
  generateToken,
} = require("./auth-helpers");
const jwt = require("jsonwebtoken");

describe("hashPassword และ verifyPassword", () => {
  test("hashPassword ควรคืนค่าที่ไม่ตรงกับรหัสผ่านต้นฉบับ", async () => {
    const hashed = await hashPassword("Passw0rd!");
    expect(hashed).not.toBe("Passw0rd!");
  });

  test("verifyPassword ควรคืนค่า true เมื่อรหัสผ่านถูกต้อง", async () => {
    const hashed = await hashPassword("Passw0rd!");
    const result = await verifyPassword("Passw0rd!", hashed);
    expect(result).toBe(true);
  });

  test("verifyPassword ควรคืนค่า false เมื่อรหัสผ่านไม่ถูกต้อง", async () => {
    const hashed = await hashPassword("Passw0rd!");
    const result = await verifyPassword("WrongPassword", hashed);
    expect(result).toBe(false);
  });
});

describe("generateToken", () => {
  test("ควรสร้าง token ที่มี payload ตรงกับข้อมูลผู้ใช้", () => {
    const user = { id: 1, email: "test@example.com", role: "student" };
    const token = generateToken(user);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    expect(decoded.id).toBe(user.id);
    expect(decoded.email).toBe(user.email);
    expect(decoded.role).toBe(user.role);
  });
});
