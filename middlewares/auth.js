const jwt = require("jsonwebtoken");

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      error: { code: "NO_TOKEN", message: "กรุณาเข้าสู่ระบบก่อนใช้งาน" },
    });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({
      error: { code: "INVALID_TOKEN", message: "Token ไม่ถูกต้องหรือหมดอายุ" },
    });
  }
}

function authorizeRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: { code: "NO_TOKEN", message: "กรุณาเข้าสู่ระบบก่อนใช้งาน" },
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "คุณไม่มีสิทธิ์เข้าถึงทรัพยากรนี้",
        },
      });
    }
    next();
  };
}

module.exports = { authenticateToken, authorizeRole };
