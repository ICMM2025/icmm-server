const express = require("express");
const adminRoute = express.Router();
const adminController = require("../controllers/admin-controller");
const authenticate = require("../middlewares/authenticate");

adminRoute.get("/export-excel", authenticate, adminController.exportExcel);
module.exports = adminRoute;
