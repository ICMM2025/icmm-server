const express = require("express");
const testRoute = express.Router();
const testController = require("../controllers/test-controller");

testRoute.get("/", testController.testDB);

module.exports = testRoute;
