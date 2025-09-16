const prisma = require("../models");
const tryCatch = require("../utils/try-catch");
const createError = require("../utils/create-error");

module.exports.getProducts = tryCatch(async (req, res, next) => {
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
    },
    include: {
      productOpts: {
        where: {
          isActive: true,
        },
      },
      productPics: {
        where: {
          isActive: true,
        },
        orderBy: {
          rank: "asc",
        },
      },
    },
  });

  res.json({ products, msg: "Get products successful..." });
});
