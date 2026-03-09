const mongoose = require("mongoose");

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function safeNumber(value, fallback = 0) {
  if (
    fallback === null &&
    (value === null || value === undefined || value === "")
  ) {
    return null;
  }

  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function inferCategory(product) {
  const raw = firstNonEmpty(
    product.category,
    product.type,
    product.productType,
    product.itemType,
    product.kind,
  );

  if (raw) return raw.toLowerCase();

  const name = firstNonEmpty(
    product.name,
    product.title,
    product.label,
  ).toLowerCase();

  if (name.includes("downspout")) return "downspout";
  if (name.includes("gutter")) return "gutter";
  if (name.includes("splash")) return "splash-guard";
  if (name.includes("guard")) return "guard";

  return "general";
}

function inferMeasurementFamily(product, category) {
  const explicit = firstNonEmpty(
    product.measurementFamily,
    product.measureType,
    product.measurementType,
  ).toLowerCase();

  if (["line", "area", "count", "text", "custom"].includes(explicit)) {
    return explicit;
  }

  const unitish = firstNonEmpty(
    product.unit,
    product.unitLabel,
    product.pricingUnit,
    product.priceUnit,
  ).toLowerCase();

  if (
    ["ft", "foot", "feet", "lf", "linear-foot", "linear feet"].includes(unitish)
  ) {
    return "line";
  }

  if (["sqft", "square-foot", "square feet"].includes(unitish)) {
    return "area";
  }

  if (["each", "ea", "count", "unit"].includes(unitish)) {
    return "count";
  }

  if (category === "gutter" || category === "downspout") return "line";
  if (category === "splash-guard" || category === "guard") return "count";

  return "custom";
}

function inferDrawingToolFamily(product, category, measurementFamily) {
  const explicit = firstNonEmpty(
    product.drawingToolFamily,
    product.toolFamily,
    product.drawType,
  ).toLowerCase();

  if (["line", "rect", "circle", "point", "text"].includes(explicit)) {
    return explicit;
  }

  if (measurementFamily === "line") return "line";
  if (measurementFamily === "area") return "rect";
  if (category === "downspout" || category === "splash-guard") return "point";

  return "point";
}

function buildSlugBase(product, name, category) {
  const preferred = firstNonEmpty(product.slug, name, category, "item");
  return slugify(preferred || "item");
}

function buildUnitLabel(product, measurementFamily) {
  const explicit = firstNonEmpty(
    product.unitLabel,
    product.unit,
    product.pricingUnit,
    product.priceUnit,
  );

  if (explicit) return explicit;

  if (measurementFamily === "line") return "ft";
  if (measurementFamily === "area") return "sqft";
  if (measurementFamily === "count") return "each";
  if (measurementFamily === "text") return "text";

  return "custom";
}

function buildDrawingDefaults(product) {
  return {
    color: firstNonEmpty(product.color, product.strokeColor) || "#000000",
    dashed: Boolean(product.dashed),
    fill: Boolean(product.fill),
    fillColor: firstNonEmpty(product.fillColor) || null,
    strokeWidth: safeNumber(product.strokeWidth, 2),
    opacity: safeNumber(product.opacity, 1),
    radius: safeNumber(product.radius, null),
    shape: firstNonEmpty(product.shape, product.markerShape) || null,
  };
}

function toObjectId(value) {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (typeof value === "string" && mongoose.Types.ObjectId.isValid(value)) {
    return new mongoose.Types.ObjectId(value);
  }
  return null;
}

function legacyProductToBusinessCatalogItem(product) {
  if (!product) {
    throw new Error("legacyProductToBusinessCatalogItem requires a product");
  }

  const businessId = toObjectId(product.businessId);
  if (!businessId) {
    return null;
  }

  const name = firstNonEmpty(
    product.name,
    product.title,
    product.label,
    product.productName,
    "Untitled Item",
  );

  const category = inferCategory(product);
  const measurementFamily = inferMeasurementFamily(product, category);
  const drawingToolFamily = inferDrawingToolFamily(
    product,
    category,
    measurementFamily,
  );

  const unitPrice = safeNumber(
    product.unitPrice ??
      product.price ??
      product.amount ??
      product.basePrice ??
      0,
    0,
  );

  return {
    businessId,
    name,
    slug: buildSlugBase(product, name, category),
    description: firstNonEmpty(product.description, product.notes, ""),
    isActive: product.isActive !== false,

    measurementFamily,
    drawingToolFamily,
    category,
    trade: "gutters",

    pricing: {
      unitPrice,
      unitLabel: buildUnitLabel(product, measurementFamily),
      currency: "usd",
    },

    drawingDefaults: buildDrawingDefaults(product),

    legacySnapshot: {
      userId: product.userId || null,
      legacyProductId: product._id || null,
      original: {
        name: product.name ?? null,
        category: product.category ?? null,
        type: product.type ?? null,
        unit: product.unit ?? null,
        price: product.price ?? null,
        color: product.color ?? null,
      },
    },

    source: {
      collection: "usergutterproducts",
      legacyId: product._id || null,
      migratedAt: new Date(),
      migrationVersion: 1,
    },

    metadata: {
      importSource: "legacy-usergutterproducts",
    },
  };
}

module.exports = {
  legacyProductToBusinessCatalogItem,
  slugify,
};
