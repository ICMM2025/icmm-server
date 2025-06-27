const express = require("express");
const uploadRoute = express.Router();
const uploadController = require("../controllers/upload-controller");
const upload = require("../middlewares/upload");
const authenticate = require("../middlewares/authenticate");

uploadRoute.post("/", upload.array("images", 1), uploadController.upload);
uploadRoute.get("/", authenticate, uploadController.getVirtualTrans);

module.exports = uploadRoute;
