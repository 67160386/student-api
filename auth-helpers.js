const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const SALT_ROUNDS = 10;

async function hashPassword(plainPassword) {
  return await bcrypt.hash(plainPassword, SALT_ROUNDS);
}

async function verifyPassword(plainPassword, hashedPassword) {
  return await bcrypt.compare(plainPassword, hashedPassword);
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN },
  );
}

// สร้างรหัสผ่านที่ผ่านการ Hash (Bcrypt)
// bcrypt.hash("Passw0rd!", 10).then((hash) => {
//   console.log("นำค่านี้ไปใส่ใน seed.sql ->", hash);
// });

module.exports = { hashPassword, verifyPassword, generateToken };
