const express = require("express");
const orderRoute = express.Router();
const orderController = require("../controllers/order-controller");
const upload = require("../middlewares/upload");

orderRoute.post("/add-order", orderController.addOrder);
module.exports = orderRoute;
orderRoute.post(
  "/send-order",
  upload.array("images", 1),
  orderController.sendOrder
);
orderRoute.post("/check-order", orderController.checkOrder);
orderRoute.post("/apply-coupon", orderController.applyCoupon);

module.exports = orderRoute;
