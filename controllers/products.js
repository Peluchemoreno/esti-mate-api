// controllers/products.js
const mongoose = require("mongoose");
const UserGutterProduct = require("../models/userGutterProduct");

// CREATE
async function createProduct(req, res, next) {
  try {
    const userId = req.user?._id;
    if (!userId)
      return res.status(401).json({ message: "Authorization required" });

    const {
      name,
      price,
      description,
      colorCode,
      unit,
      listed,
      // keep any other fields you allow...
    } = req.body;

    const doc = await UserGutterProduct.create({
      userId, // <-- owner (matches schema)
      name,
      price, // setter will coerce "$8.00" -> 8
      description: description ?? "",
      colorCode: colorCode ?? "#000000",
      unit: unit ?? "unit",
      listed: !!listed,
    });

    return res.json({ data: doc });
  } catch (err) {
    next(err);
  }
}

// READ all for this user
async function getAllProducts(req, res, next) {
  try {
    const userId = req.user?._id;
    if (!userId)
      return res.status(401).json({ message: "Authorization required" });

    const products = await UserGutterProduct.find({ userId }) // <-- correct filter
      .sort({ createdAt: -1 })
      .lean();

    console.log("[getAllProducts] uid=%s count=%d", userId, products.length);
    return res.json({ products });
  } catch (err) {
    next(err);
  }
}

// UPDATE
async function updateProduct(req, res, next) {
  try {
    const userId = req.user?._id;
    if (!userId)
      return res.status(401).json({ message: "Authorization required" });

    const { productId } = req.params;
    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const update = (({
      name,
      price,
      unit,
      colorCode,
      description,
      listed,
      removalPricePerFoot,
      repairPricePerFoot,
      gutterGuardOptions,
    }) => ({
      name,
      price,
      unit,
      colorCode,
      description,
      listed,
      removalPricePerFoot,
      repairPricePerFoot,
      gutterGuardOptions,
    }))(req.body);

    const product = await UserGutterProduct.findOneAndUpdate(
      { _id: productId, userId }, // <-- owner check by userId
      update,
      { new: true, runValidators: true }
    );

    if (!product) return res.status(404).json({ message: "Not found" });
    return res.json({ data: product });
  } catch (err) {
    next(err);
  }
}

// DELETE
async function deleteProduct(req, res, next) {
  try {
    const userId = req.user?._id;
    if (!userId)
      return res.status(401).json({ message: "Authorization required" });

    const { productId } = req.params;
    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const doc = await UserGutterProduct.findOneAndDelete({
      _id: productId,
      userId,
    });
    if (!doc) return res.status(404).json({ message: "Not found" });

    return res.json({ message: `deleted product with ID: ${doc._id}` });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createProduct,
  getAllProducts,
  updateProduct,
  deleteProduct,
};
