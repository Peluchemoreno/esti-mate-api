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
      userId, // owner
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

// controllers/products.js
async function getAllProducts(req, res) {
  try {
    const userId = req.user?._id;
    if (!userId)
      return res.status(401).json({ message: "Authorization required" });

    const scope = String(req.query.scope || "").toLowerCase();

    // Default = listed-only. "pricing" or "all" = full catalog.
    const showAll = scope === "pricing" || scope === "all";

    const filter = { userId };
    if (!showAll) {
      filter.listed = true; // default UI list
    }

    const products = await UserGutterProduct.find(filter)
      .sort({ name: 1 })
      .lean();

    // Helpful log (keep during rollout)
    console.log(
      "[getAllProducts] uid=%s scope=%s filter=%o count=%d",
      String(userId),
      scope || "default",
      filter,
      products.length
    );

    return res.status(200).send(products);
  } catch (err) {
    console.error("getAllProducts failed", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

// UPDATE (robust; supports legacy userId, consistent field names)
async function updateProduct(req, res, next) {
  try {
    const userId = req.user?._id;
    const { productId } = req.body;

    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({ error: "Invalid product id" });
    }

    // Only allow these fields from the client
    const allowed = [
      "name",
      "description",
      "price",
      "unit",
      "color",
      "colorCode", // accept either color or colorCode
      "profile",
      "size",
      "type",
      "inheritsColor",
      "inheritsUnit",
      "visual",
      "listed",
    ];

    const update = {};
    for (const k of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, k)) {
        update[k] = req.body[k];
      }
    }

    // Normalize color: accept colorCode or color; prefer explicit colorCode if present
    if (
      typeof update.colorCode === "string" &&
      update.colorCode.trim() !== ""
    ) {
      update.color = update.colorCode.trim();
    }
    delete update.colorCode;

    // Strip empty strings to avoid wiping fields accidentally
    Object.keys(update).forEach((k) => {
      if (update[k] === "") delete update[k];
    });

    const updated = await UserGutterProduct.findOneAndUpdate(
      { _id: productId, userId: userId },
      { $set: update },
      {
        new: true,
        runValidators: true,
      }
    ).lean();

    if (!updated) {
      return res.status(404).json({ error: "Product not found" });
    }

    const response = {
      ...updated,
      colorCode:
        updated.color ?? updated.colorCode ?? updated.defaultColor ?? null,
    };

    return res.json(response);
  } catch (err) {
    console.error("Update product error:", err);
    return next(err);
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
