// products.js
const mongoose = require("mongoose");
const UserGutterProduct = require("../models/userGutterProduct");
// If you intentionally keep a global template catalog, keep `Product` only for templates.

function createProduct(req, res, next) {
  try {
    const userId = req.user?._id;
    if (!userId)
      return res.status(401).json({ message: "Authorization required" });

    const { name, visual, quantity, price, listed, description } = req.body;
    return UserGutterProduct.create({
      name,
      visual,
      quantity,
      price,
      listed,
      description,
      createdBy: userId,
    })
      .then((data) => res.json({ data }))
      .catch(next);
  } catch (err) {
    return next(err);
  }
}

function deleteProduct(req, res, next) {
  try {
    const userId = req.user?._id;
    if (!userId)
      return res.status(401).json({ message: "Authorization required" });

    const { productId } = req.params; // move id to params
    if (!mongoose.isValidObjectId(productId))
      return res.status(400).json({ message: "Invalid id" });

    return UserGutterProduct.findOneAndDelete({
      _id: productId,
      createdBy: userId,
    })
      .then((doc) => {
        if (!doc) return res.status(404).json({ message: "Not found" });
        return res.json({ message: `deleted product with ID: ${doc._id}` });
      })
      .catch(next);
  } catch (err) {
    return next(err);
  }
}

function getAllProducts(req, res, next) {
  try {
    const userId = req.user?._id;
    if (!userId)
      return res.status(401).json({ message: "Authorization required" });

    return UserGutterProduct.find({ createdBy: userId })
      .lean()
      .then((products) => res.json({ products })) // [] is fine
      .catch(next);
  } catch (err) {
    return next(err);
  }
}

function updateProduct(req, res, next) {
  try {
    const userId = req.user?._id;
    if (!userId)
      return res.status(401).json({ message: "Authorization required" });

    const { productId } = req.params;
    if (!mongoose.isValidObjectId(productId))
      return res.status(400).json({ message: "Invalid id" });

    const {
      name,
      colorCode,
      price,
      unit,
      description,
      category,
      listed,
      removalPricePerFoot,
      repairPricePerFoot,
      screenOptions,
    } = req.body;

    return UserGutterProduct.findOneAndUpdate(
      { _id: productId, createdBy: userId },
      {
        name,
        price,
        unit,
        colorCode,
        description,
        category,
        listed,
        removalPricePerFoot,
        repairPricePerFoot,
        screenOptions,
      },
      { new: true, runValidators: true }
    )
      .then((product) => {
        if (!product) return res.status(404).json({ message: "Not found" });
        return res.json(product);
      })
      .catch(next);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createProduct,
  deleteProduct,
  getAllProducts,
  updateProduct,
};
