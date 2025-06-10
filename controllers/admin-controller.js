const prisma = require("../models");
const tryCatch = require("../utils/try-catch");
const createError = require("../utils/create-error");
const ExcelJS = require("exceljs");

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
