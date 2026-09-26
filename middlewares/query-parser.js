function parsePagination(req, res, next) {
  req.pagination = {
    page: Math.max(1, parseInt(req.query.page) || 1),
    limit: Math.min(100, parseInt(req.query.limit) || 10),
  };
  req.pagination.offset = (req.pagination.page - 1) * req.pagination.limit;
  next();
}

// "id" เป็นค่า default จึงต้องอยู่ใน allowlist ด้วย เพื่อให้ผู้ใช้ระบุ sort=id ได้โดยตรง
// และเพื่อไม่ให้การตรวจสอบ field ซ้ำในภายหลังปฏิเสธค่า default
const ALLOWED_SORT_FIELDS = ["id", "name", "major", "created_at"];

function parseSort(req, res, next) {
  req.sort = {
    field: ALLOWED_SORT_FIELDS.includes(req.query.sort) ? req.query.sort : "id",
    order: req.query.order === "desc" ? "DESC" : "ASC",
  };
  next();
}

module.exports = { parsePagination, parseSort };
