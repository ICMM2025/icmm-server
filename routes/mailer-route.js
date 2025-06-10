const express = require("express");
const mailerRoute = express.Router();
const mailerController = require("../controllers/mailer-controller");
const authenticate = require("../middlewares/authenticate");

mailerRoute.post("/", mailerController.sendMail);

module.exports = mailerRoute;
