const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");
const { billPayment } = require("promptparse/generate");
const { parse } = require("promptparse");

// Create payload
const payload = billPayment({
  billerId: "099904909401",
  amount: 123.5,
  ref1: "INV12345",
});

console.log("Payload1:", payload);

// Parse it (for debug/log)
const ppqr = parse(payload);
console.log("All Tags:", ppqr.getTags());
console.log("Tag 301:", ppqr.getTag(30));

const generatePayload = require("promptpay-qr");
const payload2 = generatePayload("0999049094", {
  amount: 123.5,
});

console.log("Payload2:", payload2);

// Parse it (for debug/log)
const ppqr2 = parse(payload2);
console.log("All Tags:", ppqr2.getTags());
console.log("Tag 302:", ppqr2.getTag(30));

// Generate QR image and save as file
const outputDir = path.join(__dirname, "qrcodes");
const outputPath = path.join(outputDir, "qrcode.png");

// Ensure directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Generate and save PNG
QRCode.toFile(
  outputPath,
  payload,
  {
    width: 400,
  },
  function (err) {
    if (err) return console.error("QR code generation failed:", err);
    console.log("✅ QR code saved to:", outputPath);
  }
);
