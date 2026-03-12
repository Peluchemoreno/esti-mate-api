const BusinessCatalogItem = require("../models/businessCatalogItem");
const mongoose = require("mongoose");

function slugify(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function inferRecommendedTool(payload) {
  if (payload?.behavior?.recommendedTool) {
    return payload.behavior.recommendedTool;
  }

  if (payload.drawingToolFamily) return payload.drawingToolFamily;
  if (payload.measurementFamily === "line") return "line";
  if (payload.measurementFamily === "area") return "rect";
  if (payload.measurementFamily === "text") return "text";

  return "point";
}

function inferEstimationMode(payload) {
  if (payload?.behavior?.estimationMode) {
    return payload.behavior.estimationMode;
  }

  if (payload.measurementFamily === "text") return "text";
  if (payload.measurementFamily === "custom") return "manual";

  return "measured";
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
    isActive: payload.isActive ?? true,
    measurementFamily: payload.measurementFamily,
    drawingToolFamily: payload.drawingToolFamily,
    category: payload.category || "",
    trade: payload.trade || "gutters",

    pricing: {
      unitPrice: payload?.pricing?.unitPrice ?? 0,
      unitLabel: payload?.pricing?.unitLabel ?? "",
      currency: payload?.pricing?.currency ?? "usd",
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

    ui: {
      group: payload?.ui?.group ?? "General",
      order: payload?.ui?.order ?? 100,
      iconKey: payload?.ui?.iconKey ?? null,
      badge: payload?.ui?.badge ?? null,
      visibleInQuickAdd: payload?.ui?.visibleInQuickAdd ?? true,
      visibleInPricing: payload?.ui?.visibleInPricing ?? true,
      visibleInDiagram: payload?.ui?.visibleInDiagram ?? true,
    },

    behavior: {
      estimationMode: inferEstimationMode(payload),
      supportsDiagramPlacement:
        payload?.behavior?.supportsDiagramPlacement ?? true,
      supportsFreeformPlacement:
        payload?.behavior?.supportsFreeformPlacement ?? false,
      recommendedTool: inferRecommendedTool(payload),
    },

    metadata: payload?.metadata ?? {},
  });

  return doc.toObject();
}

async function updateCatalogItem({ businessId, id, payload }) {
  const update = {};

  if (payload.name !== undefined) update.name = payload.name;
  if (payload.description !== undefined)
    update.description = payload.description;
  if (payload.measurementFamily !== undefined) {
    update.measurementFamily = payload.measurementFamily;
  }
  if (payload.drawingToolFamily !== undefined) {
    update.drawingToolFamily = payload.drawingToolFamily;
  }
  if (payload.category !== undefined) update.category = payload.category;
  if (payload.trade !== undefined) update.trade = payload.trade;
  if (payload.isActive !== undefined) update.isActive = payload.isActive;

  if (payload.pricing) {
    if (payload.pricing.unitPrice !== undefined) {
      update["pricing.unitPrice"] = payload.pricing.unitPrice;
    }
    if (payload.pricing.unitLabel !== undefined) {
      update["pricing.unitLabel"] = payload.pricing.unitLabel;
    }
    if (payload.pricing.currency !== undefined) {
      update["pricing.currency"] = payload.pricing.currency;
    }
  }

  if (payload.drawingDefaults) {
    const allowedDrawing = [
      "color",
      "dashed",
      "fill",
      "fillColor",
      "strokeWidth",
      "opacity",
      "radius",
      "shape",
    ];

    for (const key of allowedDrawing) {
      if (payload.drawingDefaults[key] !== undefined) {
        update[`drawingDefaults.${key}`] = payload.drawingDefaults[key];
      }
    }
  }

  if (payload.ui) {
    const allowedUi = [
      "group",
      "order",
      "iconKey",
      "badge",
      "visibleInQuickAdd",
      "visibleInPricing",
      "visibleInDiagram",
    ];

    for (const key of allowedUi) {
      if (payload.ui[key] !== undefined) {
        update[`ui.${key}`] = payload.ui[key];
      }
    }
  }

  if (payload.behavior) {
    const allowedBehavior = [
      "estimationMode",
      "supportsDiagramPlacement",
      "supportsFreeformPlacement",
      "recommendedTool",
    ];

    for (const key of allowedBehavior) {
      if (payload.behavior[key] !== undefined) {
        update[`behavior.${key}`] = payload.behavior[key];
      }
    }
  }

  if (payload.metadata !== undefined) {
    update.metadata = payload.metadata;
  }

  const updated = await BusinessCatalogItem.findOneAndUpdate(
    { _id: id, businessId },
    { $set: update },
    { new: true, runValidators: true },
  ).lean();

  return updated;
}

async function deleteCatalogItem({ businessId, id }) {
  return BusinessCatalogItem.findOneAndDelete({
    _id: id,
    businessId,
  });
}

async function listCatalogItems({ businessId, query = {} }) {
  const filter = { businessId };

  if (query.trade) filter.trade = query.trade;
  if (query.category) filter.category = query.category;
  if (query.measurementFamily) {
    filter.measurementFamily = query.measurementFamily;
  }
  if (query.drawingToolFamily) {
    filter.drawingToolFamily = query.drawingToolFamily;
  }

  if (query.isActive === "true") filter.isActive = true;
  if (query.isActive === "false") filter.isActive = false;

  return BusinessCatalogItem.find(filter)
    .sort({
      "ui.group": 1,
      "ui.order": 1,
      name: 1,
    })
    .lean();
}

module.exports = {
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
  listCatalogItems,
};
