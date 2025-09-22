const prisma = require("../models/index");
const tryCatch = require("../utils/try-catch");
const createError = require("../utils/create-error");
const transporter = require("../utils/mailer");
const { MailerSend, EmailParams, Sender, Recipient } = require("mailersend");
const mailerSend = new MailerSend({
  apiKey: process.env.MAILERSEND_API_KEY,
});

module.exports.sendMail = tryCatch(async (req, res, next) => {
  const { to, subject, text } = req.body;

  const sentFrom = new Sender("info@icmm.run", "Intania Runner Club");
  const recipients = [new Recipient(to, "Customer")];

  const htmlText = text.replace(/\n/g, "<br>");
  const emailParams = new EmailParams()
    .setFrom(sentFrom)
    .setTo(recipients)
    .setReplyTo(sentFrom)
    .setSubject(subject)
    .setHtml(htmlText)
    .setText(text);

  await mailerSend.email.send(emailParams);

  res.json({
    message: "Send email successful...",
  });
});
