const prisma = require("../models");
const tryCatch = require("../utils/try-catch");
const createError = require("../utils/create-error");
const jwt = require("jsonwebtoken");

module.exports = tryCatch(async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization || !authorization.startsWith(`Bearer `)) {
    createError(401, "Unauthorized");
  }
  const token = authorization.split(" ")[1];
  if (!token) {
    createError(401, "Unauthorized");
  }
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  const foundUser = await prisma.user.findUnique({
    where: {
      userId: payload.id,
    },
    select: {
      userId: true,
      userName: true,
    },
  });
  if (!foundUser) {
    createError(401, "Unauthorized");
  }
  req.user = foundUser;
  next();
});
