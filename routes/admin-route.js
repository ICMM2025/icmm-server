const express = require("express");
const adminRoute = express.Router();
const adminController = require("../controllers/admin-controller");
const authenticate = require("../middlewares/authenticate");

adminRoute.get("/export-excel", authenticate, adminController.exportExcel);
adminRoute.get("/all-orders", authenticate, adminController.getAllOrders);
adminRoute.get("/export-excel", authenticate, adminController.exportExcel);
adminRoute.post("/order-detail", authenticate, adminController.getOrderDetail);

module.exports = adminRoute;
