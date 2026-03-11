const UserGutterProduct = require("../models/userGutterProduct");
const BusinessCatalogItem = require("../models/businessCatalogItem");

function isFlagEnabled(name) {
  const raw = process.env[name];
  if (raw === undefined || raw === null) return false;

  const normalized = String(raw).trim().toLowerCase();
  return (
    normalized === "1" ||
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "on"
  );
}

function normalizeScope(scope) {
  const value = String(scope || "").toLowerCase();

  if (!value || value === "ui") return "ui";
  if (value === "pricing") return "pricing";
  if (value === "all") return "all";

  return "ui";
}

async function getLegacyProducts(filter) {
  return UserGutterProduct.find(filter).sort({ name: 1 }).lean();
}

function mapBusinessCatalogItemToLegacyProductShape(item) {
  const color =
    item?.drawingDefaults?.color ||
    item?.drawingDefaults?.fillColor ||
    "#000000";

  return {
    _id: item._id,
    businessId: item.businessId || null,
    userId: null,
    templateId: null,

    name: item.name || "",
    description: item.description || "",
    price: item?.pricing?.unitPrice ?? 0,
    unit: item?.pricing?.unitLabel || item?.measurementFamily || "unit",

    listed: item.isActive !== false,

    visual: color,
    color: color,
    colorCode: color,

    category: item.category || "",
    type: item.category || "",
    trade: item.trade || "gutters",

    measurementFamily: item.measurementFamily || "custom",
    drawingToolFamily: item.drawingToolFamily || "point",

    profile: null,
    size: null,
    inheritsColor: false,
    inheritsUnit: false,

    isGenericCatalogItem: true,
    sourceCollection: "businesscatalogitems",
    businessCatalogItemId: item._id,
    legacySource: item.source || null,

    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

async function getNativeBusinessCatalogItems({ businessId, scope }) {
  if (!businessId) return [];
  if (!isFlagEnabled("FF_GENERIC_CATALOG_READS")) return [];

  const normalizedScope = normalizeScope(scope);

  const filter = {
    businessId,
    $or: [
      { "source.collection": { $exists: false } },
      { "source.collection": null },
      { "source.collection": { $ne: "usergutterproducts" } },
    ],
  };

  if (normalizedScope === "ui") {
    filter.isActive = true;
  }

  const docs = await BusinessCatalogItem.find(filter).sort({ name: 1 }).lean();

  return docs.map(mapBusinessCatalogItemToLegacyProductShape);
}

async function getUnifiedCatalog({ filter, businessId, scope }) {
  const [legacy, generic] = await Promise.all([
    getLegacyProducts(filter),
    getNativeBusinessCatalogItems({ businessId, scope }),
  ]);

  return [...legacy, ...generic].sort((a, b) =>
    String(a?.name || "").localeCompare(String(b?.name || "")),
  );
}

module.exports = {
  getUnifiedCatalog,
};
