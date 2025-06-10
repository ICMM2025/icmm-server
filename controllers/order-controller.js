const prisma = require("../models");
const tryCatch = require("../utils/try-catch");
const createError = require("../utils/create-error");
const QRCode = require("qrcode");
const generatePayload = require("promptpay-qr");
const cloundinary = require("../utils/cloundinary");
const fs = require("fs/promises");

module.exports.addOrder = tryCatch(async (req, res, next) => {
  const { input, cart, totalAmt, grandTotalAmt, deliveryCost } = req.body;
  //   validate
  if (
    !input ||
    Object.keys(input).length === 0 ||
    !cart ||
    !Array.isArray(cart) ||
    cart.length === 0 ||
    !totalAmt?.toString().trim() ||
    !grandTotalAmt?.toString().trim() ||
    !deliveryCost?.toString().trim()
  ) {
    createError(400, "errMissing");
  }
  //   validate input
  if (
    !input?.name?.trim() ||
    !input?.email?.trim() ||
    !input?.phone?.trim() ||
    !input?.address?.trim()
  ) {
    createError(400, "errInputMissing");
  }
  //   validate cart
  for (const item of cart) {
    const { price, productId, productOptId, unit } = item;
    if (
      typeof price !== "number" ||
      price <= 0 ||
      typeof productId !== "number" ||
      productId <= 0 ||
      typeof productOptId !== "number" ||
      productOptId <= 0 ||
      typeof unit !== "number" ||
      unit <= 0
    ) {
      createError(400, "errCartMissing");
    }
  }
  //   validate totalAmt
  const productOptIds = cart.map((item) => item.productOptId);
  const productOpts = await prisma.productOpt.findMany({
    where: { productOptId: { in: productOptIds } },
    select: { productOptId: true, price: true },
  });

  const priceMap = new Map(
    productOpts.map((opt) => [opt.productOptId, opt.price])
  );
  let expectedTotal = 0;
  for (const item of cart) {
    const price = priceMap.get(item.productOptId);
    if (price == null) {
      createError(400, "errInvalidProdectOptId");
    }
    expectedTotal += price * item.unit;
  }

  if (Number(totalAmt) !== expectedTotal) {
    createError(400, "errTotalAmtMismatch");
  }

  //   validate grandTotalAmt
  const total = Number(totalAmt);
  const delivery = Number(deliveryCost);
  const grandTotal = Number(grandTotalAmt);

  if (
    Math.round((total + delivery) * 100) / 100 !==
    Math.round(grandTotal * 100) / 100
  ) {
    createError(400, "errGrandTotalMismatch");
  }

  // Create order first
  const order = await prisma.order.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      address: input.address, // fixed typo here
      remark: input.remark || "",
      totalAmt,
      deliveryCost,
      grandTotalAmt,
    },
  });

  // Add order details in sequence
  for (const el of cart) {
    await prisma.orderDetail.create({
      data: {
        orderId: order.orderId,
        productId: el.productId,
        productOptId: el.productOptId,
        unit: el.unit,
        price: el.price,
      },
    });
  }

  //generate QR code
  const PROMPTPAY_ID = process.env.PROMPTPAY_ID;
  const payload = generatePayload(PROMPTPAY_ID, {
    amount: Number(order.grandTotalAmt),
    ref1: order.orderId.toString(),
  });
  const qrDataUrl = await QRCode.toDataURL(payload, { width: 400 });
  //upload to Cloudinary
  let uploadRes;
  try {
    uploadRes = await cloundinary.uploader.upload(qrDataUrl, {
      overwrite: true,
      folder: "icmm/promptpay_qr",
      public_id: `order_${order.orderId}_qr`,
      width: 400,
      height: 400,
      crop: "limit",
    });
  } catch (err) {
    return next(createError(500, "errFailToUploadQr"));
  }

  //update url on DB
  await prisma.order.update({
    where: { orderId: order.orderId },
    data: { payQrUrl: uploadRes.secure_url },
  });

  res.json({
    // input,
    // cart,
    // totalAmt,
    // grandTotalAmt,
    // deliveryCost,
    orderId: order.orderId,
    qrUrl: uploadRes.secure_url,
    grandTotalAmt: order.grandTotalAmt,
    msg: "Add Order successful...",
  });
});

module.exports.sendOrder = tryCatch(async (req, res, next) => {
  const { orderId } = req.body;
  // Validate orderId and file
  if (!orderId || isNaN(orderId)) {
    createError(400, "errInvalidOrderId");
  }
  if (!req.file) {
    createError(400, "errNoFileUploaded");
  }
  // Upload to Cloudinary
  let result;
  try {
    result = await cloundinary.uploader.upload(req.file.path, {
      overwrite: true,
      folder: "icmm/from_user",
      public_id: `order_${orderId}_user_upload`,
      width: 1000,
      height: 1000,
      crop: "limit",
    });
    await fs.unlink(req.file.path);
  } catch (err) {
    return next(createError(500, "errFailToUploadEvidence"));
  }

  // Update order record with uploaded URL
  const order = await prisma.order.update({
    where: { orderId: Number(orderId) },
    data: { userUploadPicUrl: result.secure_url, statusId: 2 },
  });
  res.json({
    order,
    msg: "Send Order successful...",
  });
});

module.exports.checkOrder = tryCatch(async (req, res, next) => {
  const { input } = req.body;
  // validate
  if (!input.orderNo || !input.email) {
    createError(400, "errLackData");
  }
  const order = await prisma.order.findFirst({
    where: {
      orderId: input.orderNo,
      email: input.email,
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
    },
  });
  if (!order) {
    createError(400, "errOrderNotFound");
  }

  res.json({
    order,
    msg: "Check Order successful...",
  });
});
