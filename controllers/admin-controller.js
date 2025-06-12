const prisma = require("../models");
const tryCatch = require("../utils/try-catch");
const createError = require("../utils/create-error");
const ExcelJS = require("exceljs");
const cloudinary = require("../utils/cloudinary");
const fs = require("fs/promises");
const path = require("path");

module.exports.exportExcel = tryCatch(async (req, res, next) => {
  const data = await prisma.order.findMany({
    include: {
      status: true,
      orderDetails: {
        include: {
          product: {
            include: {
              productPics: true,
            },
          },
          productOpt: true,
        },
      },
    },
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Orders");

  // Add headers
  sheet.addRow([
    "Order ID",
    "Name",
    "Email",
    "Phone",
    "Product",
    "Option",
    "Qty",
    "Price",
    "Status",
    "Product Pic URL",
  ]);

  // Add data
  data.forEach((order) => {
    order.orderDetails.forEach((detail) => {
      sheet.addRow([
        order.orderId,
        order.name,
        order.email,
        order.phone,
        detail.product.name,
        detail.productOpt.optName,
        detail.unit,
        detail.price,
        order.status.name,
        detail.product.productPics[0]?.url || "",
      ]);
    });
  });

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", "attachment; filename=data.xlsx");
  await workbook.xlsx.write(res);
  res.end();
});

module.exports.getAllOrders = tryCatch(async (req, res, next) => {
  const orders = await prisma.order.findMany({
    select: {
      statusId: true,
      orderId: true,
      status: true,
      name: true,
      email: true,
      phone: true,
      grandTotalAmt: true,
      createdAt: true,
      isImportant: true,
      notes: true,
    },
  });

  // Add `haveNote` field manually
  const modifiedOrders = orders.map((order) => ({
    ...order,
    haveNote: order.notes.some((note) => note.isRobot === false),
  }));
  res.json({ orders: modifiedOrders, msg: "Get all orders successful..." });
});

module.exports.getOrderDetail = tryCatch(async (req, res, next) => {
  const { orderId } = req.body;
  const order = await prisma.order.findFirst({
    where: {
      orderId: orderId,
    },
    include: {
      orderDetails: {
        include: {
          product: {
            include: {
              productPics: true, // correctly plural based on your schema
            },
          },
          productOpt: true,
        },
      },
      status: true,
      notes: true,
      adminPhotos: true,
    },
  });
  const status = await prisma.status.findMany({
    orderBy: {
      statusId: "asc",
    },
  });
  res.json({
    order,
    status,
    msg: "Check Order successful...",
  });
});

module.exports.addNote = tryCatch(async (req, res, next) => {
  const { noteTxt, orderId } = req.body;
  const newNote = await prisma.note.create({
    data: {
      orderId: Number(orderId),
      noteTxt,
      isRobot: false,
    },
  });

  res.json({
    // noteTxt,
    // orderId,
    newNote,
    msg: "Add note successful...",
  });
});

module.exports.editDetailOrder = tryCatch(async (req, res, next) => {
  const {
    orderId,
    statusId,
    isImportant,
    name,
    email,
    phone,
    address,
    remark,
    totalAmt,
    deliveryCost,
    grandTotalAmt,
    emsTracking,
  } = req.body;
  await prisma.order.update({
    where: { orderId: +orderId },
    data: {
      statusId,
      isImportant,
      name,
      email,
      phone,
      address,
      remark,
      totalAmt,
      deliveryCost,
      grandTotalAmt,
      emsTracking,
    },
  });

  res.json({
    msg: "Edit detail order successful...",
  });
});

module.exports.forwardStatus = tryCatch(async (req, res, next) => {
  const { statusId, orderId } = req.body;

  await prisma.order.update({
    where: {
      orderId,
    },
    data: {
      statusId,
    },
  });

  res.json({
    msg: "Add note successful...",
  });
});

module.exports.editDetailAdminPhotoOrder = tryCatch(async (req, res, next) => {
  const { orderId } = req.body;
  // Validate orderId and file
  if (!orderId || isNaN(orderId)) {
    createError(400, "errInvalidOrderId");
  }
  if (!req.files) {
    createError(400, "errNoFileUploaded");
  }
  // Upload to Cloudinary
  const haveFiles = !!req.files;
  let uploadResults = [];
  if (haveFiles) {
    for (const file of req.files) {
      try {
        const uploadResult = await cloudinary.uploader.upload(file.path, {
          overwrite: true,
          folder: "icmm/admin_photo",
          public_id: path.parse(file.path).name,
          width: 1000,
          height: 1000,
          crop: "limit",
        });
        uploadResults.push(uploadResult.secure_url);
        await fs.unlink(file.path);
      } catch (err) {
        return next(createError(500, "errFailToUploadEvidence"));
      }
    }
  }
  // update pic
  for (const rs of uploadResults) {
    await prisma.adminPhoto.create({
      data: { orderId: Number(orderId), picUrl: rs },
    });
  }
  res.json({
    msg: "Edit detial admin photo successful...",
  });
});
