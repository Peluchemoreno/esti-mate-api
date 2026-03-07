const mongoose = require("mongoose");
const UserGutterProduct = require("../models/userGutterProduct");
const { ensureUserCatalog } = require("../services/productCopyService");

function getOwnershipFilter(req) {
  const userId = req.user?._id;
  const businessId = req.businessId || req.user?.personalBusinessId || null;

  if (businessId) {
    return {
      $or: [{ businessId }, { userId }],
    };
  }

  return { userId };
}

function getBusinessId(req) {
  return req.businessId || req.user?.personalBusinessId || null;
}

// CREATE
async function createProduct(req, res, next) {
  try {
    const userId = req.user?._id;
    const businessId = getBusinessId(req);

    if (!userId) {
      return res.status(401).json({ message: "Authorization required" });
    }

    const { name, price, description, colorCode, unit, listed } = req.body;

    const chosen =
      typeof colorCode === "string" && colorCode.trim()
        ? colorCode.trim()
        : "#000000";

    const doc = await UserGutterProduct.create({
      userId,
      businessId,
      name,
      price,
      description: description ?? "",
      visual: chosen,
      colorCode: chosen,
      unit: unit ?? "unit",
      listed: !!listed,
    });

    return res.json({ data: doc });
  } catch (err) {
    next(err);
  }
}

// GET ALL
async function getAllProducts(req, res) {
  try {
    const userId = req.user?._id;
    const businessId = getBusinessId(req);

    if (!userId) {
      return res.status(401).json({ message: "Authorization required" });
    }

    const scope = String(req.query.scope || "").toLowerCase();
    const showAll = scope === "pricing" || scope === "all";

    let filter = getOwnershipFilter(req);

    if (!scope || scope === "ui") {
      filter = {
        $and: [
          getOwnershipFilter(req),
          {
            templateId: { $ne: null },
            listed: true,
          },
        ],
      };
    } else if (scope === "pricing" || scope === "all") {
      // keep full ownership filter only
    } else {
      return res.status(400).json({ error: "Invalid scope" });
    }

    let products = await UserGutterProduct.find(filter)
      .sort({ name: 1 })
      .lean();

    if ((!scope || scope === "ui") && products.length === 0) {
      const existingCount = await UserGutterProduct.countDocuments(
        getOwnershipFilter(req),
      );

      if (existingCount === 0) {
        await ensureUserCatalog(userId);

        if (businessId) {
          await UserGutterProduct.updateMany(
            {
              userId,
              $or: [{ businessId: { $exists: false } }, { businessId: null }],
            },
            { $set: { businessId } },
          );
        }

        products = await UserGutterProduct.find(filter)
          .sort({ name: 1 })
          .lean();
      }
    }

    console.log(
      "[getAllProducts] uid=%s biz=%s scope=%s filter=%o count=%d",
      String(userId),
      businessId ? String(businessId) : "none",
      scope || "default",
      filter,
      products.length,
    );

    return res.status(200).send(products);
  } catch (err) {
    console.error("getAllProducts failed", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

// UPDATE
async function updateProduct(req, res, next) {
  try {
    const userId = req.user?._id;
    const businessId = getBusinessId(req);
    const { productId } = req.body;

    if (!userId) {
      return res.status(401).json({ message: "Authorization required" });
    }

    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({ error: "Invalid product id" });
    }

    const allowed = [
      "name",
      "description",
      "price",
      "unit",
      "color",
      "colorCode",
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

    const incomingVisual =
      typeof update.visual === "string" && update.visual.trim()
        ? update.visual.trim()
        : typeof update.colorCode === "string" && update.colorCode.trim()
        ? update.colorCode.trim()
        : null;

    if (incomingVisual) {
      update.visual = incomingVisual;
      update.colorCode = incomingVisual;
    }

    Object.keys(update).forEach((k) => {
      if (update[k] === "") delete update[k];
    });

    const ownershipFilter = businessId
      ? {
          _id: productId,
          $or: [{ businessId }, { userId }],
        }
      : {
          _id: productId,
          userId,
        };

    const updated = await UserGutterProduct.findOneAndUpdate(
      ownershipFilter,
      { $set: update },
      {
        new: true,
        runValidators: true,
      },
    ).lean();

    if (!updated) {
      return res.status(404).json({ error: "Product not found" });
    }

    const response = {
      ...updated,
      colorCode:
        updated.visual ??
        updated.color ??
        updated.colorCode ??
        updated.defaultColor ??
        null,
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
    const businessId = getBusinessId(req);

    if (!userId) {
      return res.status(401).json({ message: "Authorization required" });
    }

    const { productId } = req.params;
    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const ownershipFilter = businessId
      ? {
          _id: productId,
          $or: [{ businessId }, { userId }],
        }
      : {
          _id: productId,
          userId,
        };

    const doc = await UserGutterProduct.findOneAndDelete(ownershipFilter);

    if (!doc) {
      return res.status(404).json({ message: "Not found" });
    }

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
