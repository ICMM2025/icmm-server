const prisma = require("../models/index");
const tryCatch = require("../utils/try-catch");
const createError = require("../utils/create-error");
const transporter = require("../utils/mailer");

module.exports.sendMail = tryCatch(async (req, res, next) => {
  const { to, subject, text } = req.body;
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject,
    text,
  };

  await transporter.sendMail(mailOptions);
  res.json({
    message: "Send email successful...",
  });
});
