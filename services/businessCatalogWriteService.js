const BusinessCatalogItem = require("../models/businessCatalogItem");
const mongoose = require("mongoose");

function slugify(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function createCatalogItem({ businessId, payload }) {
  const baseSlug = slugify(payload.name);
  const suffix = new mongoose.Types.ObjectId().toString().slice(-6);

  const slug = `${baseSlug}-${suffix}`;

  const doc = await BusinessCatalogItem.create({
    businessId,
    name: payload.name,
    slug,

    description: payload.description || "",

    measurementFamily: payload.measurementFamily,
    drawingToolFamily: payload.drawingToolFamily,

    category: payload.category || "",
    trade: payload.trade || "gutters",

    pricing: {
      unitPrice: payload?.pricing?.unitPrice ?? 0,
      unitLabel: payload?.pricing?.unitLabel ?? "",
    },

    drawingDefaults: {
      color: payload?.drawingDefaults?.color ?? "#000000",
      dashed: payload?.drawingDefaults?.dashed ?? false,
      fill: payload?.drawingDefaults?.fill ?? false,
      fillColor: payload?.drawingDefaults?.fillColor ?? null,
      strokeWidth: payload?.drawingDefaults?.strokeWidth ?? 2,
      opacity: payload?.drawingDefaults?.opacity ?? 1,
      radius: payload?.drawingDefaults?.radius ?? null,
      shape: payload?.drawingDefaults?.shape ?? null,
    },
  });

  return doc;
}

async function updateCatalogItem({ businessId, id, payload }) {
  const updated = await BusinessCatalogItem.findOneAndUpdate(
    {
      _id: id,
      businessId,
    },
    { $set: payload },
    { new: true, runValidators: true },
  ).lean();

  return updated;
}

async function deleteCatalogItem({ businessId, id }) {
  const doc = await BusinessCatalogItem.findOneAndDelete({
    _id: id,
    businessId,
  });

  return doc;
}

module.exports = {
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
};
