const express = require("express");
const adminRoute = express.Router();
const adminController = require("../controllers/admin-controller");
const authenticate = require("../middlewares/authenticate");
const upload = require("../middlewares/upload");

adminRoute.get("/export-excel", authenticate, adminController.exportExcel);
adminRoute.get("/all-orders", authenticate, adminController.getAllOrders);
adminRoute.get("/export-excel", authenticate, adminController.exportExcel);
adminRoute.post("/order-detail", authenticate, adminController.getOrderDetail);
adminRoute.post("/add-note", authenticate, adminController.addNote);
adminRoute.post(
  "/edit-detail-order",
  authenticate,
  adminController.editDetailOrder
);
adminRoute.post(
  "/edit-detail-admin-photo-order",
  authenticate,
  upload.array("images", 10),
  adminController.editDetailAdminPhotoOrder
);
adminRoute.post("/forward-status", authenticate, adminController.forwardStatus);
adminRoute.post("/edit-cart", authenticate, adminController.editCart);
module.exports = adminRoute;
