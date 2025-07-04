require("dotenv").config();
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const axios = require("axios");
const prisma = require("../models");
const tryCatch = require("../utils/try-catch");
const createError = require("../utils/create-error");
const QRCode = require("qrcode");
const generatePayload = require("promptpay-qr");
const cloudinary = require("../utils/cloudinary");
const FormData = require("form-data");

const maskName = (name) =>
  name ? name[0] + "***" + name[name.length - 1] : "";
const maskEmail = (email) => {
  if (!email) return "";
  const [user, domain] = email.split("@");
  return user.slice(0, 3) + "***" + domain.slice(-3);
};
const maskPhone = (phone) =>
  phone ? phone.slice(0, 3) + "***" + phone.slice(-2) : "";
const maskAddress = (addr) => {
  if (!addr || addr.length < 6) return addr;
  return addr.slice(0, 5) + "***" + addr.slice(-3);
};

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

  const discountAmt = input.discountAmt || 0;
  const expectedGrandTotal =
    Math.round((total + delivery - discountAmt) * 100) / 100;
  if (expectedGrandTotal !== Math.round(grandTotal * 100) / 100) {
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
      discountCode: input.code || null,
      discountAmt: input.discountAmt || 0,
    },
  });

  // update inactive coupon
  await prisma.coupon.updateMany({
    where: {
      discountCode: input.code,
    },
    data: {
      isActive: false,
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
    uploadRes = await cloudinary.uploader.upload(qrDataUrl, {
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
  // add note
  await prisma.note.create({
    data: {
      noteTxt: `User created new order [status = userNotPaid]`,
      orderId: Number(order.orderId),
      isRobot: true,
    },
  });

  res.json({
    orderId: order.orderId,
    qrUrl: uploadRes.secure_url,
    grandTotalAmt: order.grandTotalAmt,
    msg: "Add Order successful...",
  });
});

module.exports.sendOrder = tryCatch(async (req, res, next) => {
  const RECEIVE_ACC = "XXXXXXXXXXX1501";
  const { orderId } = req.body;

  if (!orderId || isNaN(orderId)) throw createError(400, "errInvalidOrderId");
  if (!req.files || req.files.length === 0)
    throw createError(400, "errNoFileUploaded");

  let uploadResults = [];
  let localFilePaths = [];

  // 1. Upload to Cloudinary & collect local paths
  for (const file of req.files) {
    try {
      const uploadResult = await cloudinary.uploader.upload(file.path, {
        overwrite: true,
        folder: "icmm/from_user",
        public_id: `order_${orderId}_user_upload`,
        width: 1000,
        height: 1000,
        crop: "limit",
      });
      uploadResults.push(uploadResult.secure_url);
      localFilePaths.push(file.path);
    } catch (err) {
      return next(createError(500, "errFailToUploadEvidence"));
    }
  }

  const imageUrl = uploadResults[0];
  const localFilePath = localFilePaths[0];

  // 2. Update order image + status
  let order = await prisma.order.update({
    where: { orderId: Number(orderId) },
    data: {
      userUploadPicUrl: imageUrl,
      statusId: 2,
    },
  });

  // 3. Send to EasySlip with file upload
  let slipData = {};
  let checkSlipNote = null;
  let easyslip = {};

  try {
    const form = new FormData();
    form.append("file", fs.createReadStream(localFilePath));

    easyslip = await axios.post(
      "https://developer.easyslip.com/api/v1/verify",
      form,
      {
        headers: {
          Authorization: `Bearer ${process.env.EASYSLIP_API_KEY}`,
          ...form.getHeaders(),
        },
      }
    );

    if (easyslip.status === 200 && easyslip.data?.data) {
      const result = easyslip.data.data;

      const slipAmount = Number(result.amount?.amount || 0);
      const senderName = result.sender?.account?.name?.th || "";
      const senderAcc = result.sender?.account?.bank?.account || "";
      const receiverName = result.receiver?.account?.name?.th || "";
      const receiverAcc = result.receiver?.account?.proxy?.account || "";

      const isSlipFail =
        slipAmount !== Number(order.grandTotalAmt) ||
        receiverAcc !== RECEIVE_ACC;

      slipData = {
        slipAmt: slipAmount,
        slipSenderName: senderName,
        slipSenderAcc: senderAcc,
        slipReceiverName: receiverName,
        slipReceiverAcc: receiverAcc,
        isCheckSlipFail: isSlipFail,
        checkSlipNote: `Matched = ${!isSlipFail}`,
      };
    } else {
      checkSlipNote = `EasySlip response invalid (status: ${easyslip.status})`;
    }
  } catch (err) {
    checkSlipNote = `EasySlip error: ${err.message}`;
  }

  // 4. Update slip info on order
  await prisma.order.update({
    where: { orderId: Number(orderId) },
    data: {
      ...slipData,
      checkSlipNote,
    },
  });

  // 5. Add system note
  await prisma.note.create({
    data: {
      noteTxt: checkSlipNote
        ? `User submitted slip. EasySlip error logged.`
        : `User submitted slip. AI check: ${
            slipData.isCheckSlipFail ? "Mismatch" : "Matched"
          }.`,
      orderId: Number(orderId),
      isRobot: true,
    },
  });

  // 6. Cleanup file
  await fsp.unlink(localFilePath).catch(() => {});

  // 7. Respond to frontend
  res.json({
    orderId,
    msg: "Send Order successful. Awaiting admin verification.",
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

  // mask sensitive data
  order.name = maskName(order.name);
  // order.email = maskEmail(order.email);
  order.phone = maskPhone(order.phone);
  order.address = maskAddress(order.address);

  // coupon
  let coupon = null;
  if (order.discountCode) {
    coupon = await prisma.coupon.findFirst({
      where: { discountCode: order.discountCode },
      select: {
        discountType: true,
        discountAmt: true,
        maxDiscountAmt: true,
      },
    });
  }
  res.json({
    order,
    coupon,
    msg: "Check Order successful...",
  });
});

module.exports.applyCoupon = tryCatch(async (req, res, next) => {
  const { discountCode } = req.body;
  //validate
  // code is blank
  if (!discountCode || discountCode.trim() === "") {
    createError(400, "errPlaseFillCode");
  }
  // code not active
  const coupon = await prisma.coupon.findFirst({
    where: {
      discountCode: discountCode.trim(),
      isActive: true,
    },
  });

  if (!coupon) {
    createError(400, "errCodeNotFound");
  }

  res.json({
    coupon,
    msg: "Apply coupon successful...",
  });
});
