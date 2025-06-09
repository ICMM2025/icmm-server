const express = require("express");
const orderRoute = express.Router();
const orderController = require("../controllers/order-controller");
const upload = require("../middlewares/upload");

orderRoute.post("/add-order", orderController.addOrder);
module.exports = orderRoute;
