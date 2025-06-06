const prisma = require("../models/index");
const tryCatch = require("../utils/try-catch");
const createError = require("../utils/create-error");
const transporter = require("../utils/mailer");

module.exports.sendVerificationCode = tryCatch(async (req, res, next) => {
  const { id, to, subject, text } = req.body;
  // const code = await prisma.emailVerification.findUnique({
  //   where: {
  //     id,
  //   },
  //   select: {
  //     code: true,
  //   },
  // });
  // const newTxt = text.replace("xxxxxx", code.code);
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject,
    text: newTxt,
  };

  await transporter.sendMail(mailOptions);
  res.json({
    mailOptions,
    code,
    message: "Send email verification code successful...",
  });
});
