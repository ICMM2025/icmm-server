const prisma = require("../models");
const tryCatch = require("../utils/try-catch");
const createError = require("../utils/create-error");

module.exports.getProducts = tryCatch(async (req, res, next) => {
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
    },
    include: {
      productOpts: true,
      productPics: {
        orderBy: {
          rank: "asc",
        },
      },
    },
  });

  res.json({ products, msg: "Get products successful..." });
});
