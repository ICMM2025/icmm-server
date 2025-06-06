const prisma = require("../models/index");
const tryCatch = require("../utils/try-catch");
const createError = require("../utils/create-error");

module.exports.testDB = tryCatch(async (req, res, next) => {
  const test = await prisma.test.findUnique({
    where: {
      testId: 1,
    },
  });
  res.json({ test, msg: "TestDB successful...." });
});
