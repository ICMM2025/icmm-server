const prisma = require("../models");
const tryCatch = require("../utils/try-catch");
const createError = require("../utils/create-error");
const ExcelJS = require("exceljs");
const cloudinary = require("../utils/cloudinary");
const fs = require("fs/promises");
const path = require("path");

module.exports.exportExcel = tryCatch(async (req, res, next) => {
  const [orders, notes, adminPhotos, products, productOpts, productPics] =
    await Promise.all([
      prisma.order.findMany({
        include: {
          status: true,
          orderDetails: {
            include: {
              product: true,
              productOpt: true,
            },
          },
        },
      }),
      prisma.note.findMany(),
      prisma.adminPhoto.findMany(),
      prisma.product.findMany(),
      prisma.productOpt.findMany(),
      prisma.productPic.findMany(),
    ]);

  const workbook = new ExcelJS.Workbook();

  // Orders Sheet
  const orderSheet = workbook.addWorksheet("order");
  orderSheet.addRow([
    "Order ID",
    "Name",
    "Email",
    "Phone",
    "Product",
    "Option",
    "Qty",
    "Price",
    "Status",
  ]);
  orders.forEach((order) => {
    order.orderDetails.forEach((detail) => {
      orderSheet.addRow([
        order.orderId,
        order.name,
        order.email,
        order.phone,
        detail.product.name,
        detail.productOpt.optName,
        detail.unit,
        detail.price,
        order.status.name,
      ]);
    });
  });

  // Order Detail Sheet
  const detailSheet = workbook.addWorksheet("order_detail");
  detailSheet.addRow([
    "Order Detail ID",
    "Order ID",
    "Product ID",
    "Product Opt ID",
    "Qty",
    "Price",
  ]);
  orders.forEach((order) => {
    order.orderDetails.forEach((detail) => {
      detailSheet.addRow([
        detail.orderDetailId,
        order.orderId,
        detail.productId,
        detail.productOptId,
        detail.unit,
        detail.price,
      ]);
    });
  });

  // Note Sheet
  const noteSheet = workbook.addWorksheet("note");
  noteSheet.addRow(["Note ID", "Order ID", "Note Text", "Is Robot"]);
  notes.forEach((note) => {
    noteSheet.addRow([note.noteId, note.orderId, note.noteTxt, note.isRobot]);
  });

  // Admin Photo Sheet
  const adminPhotoSheet = workbook.addWorksheet("admin_photo");
  adminPhotoSheet.addRow(["Photo ID", "Order ID", "Pic URL"]);
  adminPhotos.forEach((photo) => {
    adminPhotoSheet.addRow([photo.adminPhotoId, photo.orderId, photo.picUrl]);
  });

  // Product Sheet (Join Product and ProductOpt)
  const productSheet = workbook.addWorksheet("product");
  productSheet.addRow([
    "Product ID",
    "Product Name",
    "Option ID",
    "Option Name",
    "Option Price",
  ]);
  products.forEach((product) => {
    const opts = productOpts.filter(
      (opt) => opt.productId === product.productId
    );
    if (opts.length > 0) {
      opts.forEach((opt) => {
        productSheet.addRow([
          product.productId,
          product.name,
          opt.productOptId,
          opt.optName,
          opt.price,
        ]);
      });
    } else {
      productSheet.addRow([product.productId, product.name, "", "", ""]);
    }
  });

  // Product Pic Sheet
  const picSheet = workbook.addWorksheet("product_pic");
  picSheet.addRow(["Pic ID", "Product ID", "Rank", "URL"]);
  productPics.forEach((pic) => {
    picSheet.addRow([pic.productPicId, pic.productId, pic.rank, pic.url]);
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
      orderDetails: true,
    },
  });
  const productOpts = await prisma.productOpt.findMany();

  // Add `haveNote` field manually
  const modifiedOrders = orders.map((order) => ({
    ...order,
    haveNote: order.notes.some((note) => note.isRobot === false),
  }));
  res.json({
    productOpts,
    orders: modifiedOrders,
    msg: "Get all orders successful...",
  });
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
  const order = await prisma.order.update({
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
    select: {
      status: true,
    },
  });
  await prisma.note.create({
    data: {
      noteTxt: `Admin edited order detail [status = ${order.status.name}]`,
      orderId: Number(orderId),
      isRobot: true,
    },
  });

  res.json({
    msg: "Edit detail order successful...",
  });
});

module.exports.forwardStatus = tryCatch(async (req, res, next) => {
  const { statusId, orderId } = req.body;

  const order = await prisma.order.update({
    where: {
      orderId,
    },
    data: {
      statusId,
    },
    select: {
      status: true,
    },
  });
  console.log(order);
  // note
  await prisma.note.create({
    data: {
      noteTxt: `Admin forword order [status = ${order.status.name}]`,
      orderId: Number(orderId),
      isRobot: true,
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

module.exports.editCart = tryCatch(async (req, res, next) => {
  const { orderId, newCart } = req.body;

  await prisma.$transaction(async (tx) => {
    // Delete existing order details for the order
    await tx.orderDetail.deleteMany({
      where: { orderId: Number(orderId) },
    });

    // Insert each new cart item
    await tx.orderDetail.createMany({
      data: newCart.map((item) => ({
        orderId: Number(orderId),
        productId: item.productId,
        productOptId: item.productOptId,
        unit: item.unit,
        price: parseFloat(item.price.toFixed(2)), // force 2 decimal precision
      })),
    });
  });

  // note
  await prisma.note.create({
    data: {
      noteTxt: `Admin revise cart's detail`,
      orderId: Number(orderId),
      isRobot: true,
    },
  });
  res.json({ msg: "Cart updated successfully." });
});
