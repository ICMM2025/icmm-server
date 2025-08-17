const prisma = require("../models");
const tryCatch = require("../utils/try-catch");
const createError = require("../utils/create-error");

module.exports.addCoupon = tryCatch(async (req, res, next) => {
  const { code, pwd } = req.params;
  res.json({ msg: "Coupon added..." });
});
