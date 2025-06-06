const express = require("express");
const productsRoute = express.Router();
const productsController = require("../controllers/products-controller");

productsRoute.get("/", productsController.getProducts);
module.exports = productsRoute;
