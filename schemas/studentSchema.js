const { z } = require("zod");

const createStudentSchema = z
  .object({
    name: z.string().min(2).max(100),
    major: z.string().min(1).max(100),
    email: z.string().email(),
    passportNumber: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.major.startsWith("International") && !data.passportNumber) {
      ctx.addIssue({
        code: "custom",
        message: "ต้องระบุ passportNumber สำหรับสาขานานาชาติ",
        path: ["passportNumber"],
      });
    }
  });

module.exports = { createStudentSchema };
