const path = require("path");
const multer = require("multer");

const storage = multer.diskStorage({
  destination: (req, file, cb) =>
    cb(null, path.join(__dirname, "../upload-pic")),
  filename: (req, file, cb) => {
    const { orderId } = req.body;
    const fullFilename = `${orderId}_${Date.now()}_${Math.round(
      Math.random() * 1000
    )}${path.extname(file.originalname)}`;
    cb(null, fullFilename);
  },
});

module.exports = multer({ storage });
