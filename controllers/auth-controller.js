const prisma = require("../models");
const tryCatch = require("../utils/try-catch");
const createError = require("../utils/create-error");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

module.exports.register = tryCatch(async (req, res, next) => {
  const { userName, userPassword } = req.body;
  //hash password
  const hashedPassword = await bcrypt.hash(userPassword, 10);
  //insert db create new user
  const newUser = await prisma.user.create({
    data: {
      userName,
      userPassword: hashedPassword,
    },
    select: {
      userId: true,
      userName: true,
    },
  });
  res.json({ msg: "Register successful...", newUser });
});

module.exports.login = tryCatch(async (req, res, next) => {
  // const { name, password } = req.body;
  // const user = await prisma.user.findUnique({
  //   where: {
  //     userName: name,
  //   },
  // });
  // if (!user) {
  //   createError(400, "User not found!");
  // }
  // //compare password
  // const isPasswordMatch = await bcrypt.compare(password, user.userPassword);
  // if (!isPasswordMatch) {
  //   return createError(400, "User or password is invalid!");
  // }
  // //create access token
  // const token = jwt.sign({ id: user.userId }, process.env.JWT_SECRET, {
  //   expiresIn: "30d",
  // });
  // //reuturn user
  // const returnUser = await prisma.user.findUnique({
  //   where: {
  //     userId: user.userId,
  //   },
  //   select: {
  //     userId: true,
  //     userName: true,
  //   },
  // });
  // res.json({ token, user: returnUser, msg: "Login successful..." });
  res.json({ msg: "Login successful..." });
});
