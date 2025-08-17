const express = require("express");
const couponRoute = express.Router();
const couponController = require("../controllers/coupon-controller");

couponRoute.get("/add/:code/:pwd", couponController.addCoupon);

module.exports = couponRoute;
