const prisma = require("../models");
const tryCatch = require("../utils/try-catch");
const createError = require("../utils/create-error");

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
  expectedTotal = Math.round(expectedTotal * 100) / 100;

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
  //upload to Cloudinary

  res.json({
    // input,
    // cart,
    // totalAmt,
    // grandTotalAmt,
    // deliveryCost,
    orderId: order.orderId,
    qrUrl: "",
    grandTotalAmt: order.grandTotalAmt,
    msg: "Add Order successful...",
  });
});
