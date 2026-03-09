const mongoose = require("mongoose");

const { Schema } = mongoose;

const BUSINESS_CATALOG_MEASUREMENT_FAMILIES = [
  "line",
  "area",
  "count",
  "text",
  "custom",
];

const BUSINESS_CATALOG_TOOL_FAMILIES = [
  "line",
  "rect",
  "circle",
  "point",
  "text",
];

const drawingDefaultsSchema = new Schema(
  {
    color: { type: String, default: "#000000" },
    dashed: { type: Boolean, default: false },
    fill: { type: Boolean, default: false },
    fillColor: { type: String, default: null },
    strokeWidth: { type: Number, default: 2 },
    opacity: { type: Number, default: 1 },
    radius: { type: Number, default: null },
    shape: { type: String, default: null },
  },
  { _id: false },
);

const pricingSchema = new Schema(
  {
    unitPrice: { type: Number, default: 0 },
    unitLabel: { type: String, default: "" },
    currency: { type: String, default: "usd" },
  },
  { _id: false },
);

const sourceSchema = new Schema(
  {
    collection: { type: String, default: null },
    legacyId: { type: Schema.Types.ObjectId, default: null },
    migratedAt: { type: Date, default: null },
    migrationVersion: { type: Number, default: 1 },
  },
  { _id: false },
);

const businessCatalogItemSchema = new Schema(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    measurementFamily: {
      type: String,
      enum: BUSINESS_CATALOG_MEASUREMENT_FAMILIES,
      required: true,
      index: true,
    },

    drawingToolFamily: {
      type: String,
      enum: BUSINESS_CATALOG_TOOL_FAMILIES,
      required: true,
      index: true,
    },

    category: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    trade: {
      type: String,
      default: "gutters",
      trim: true,
      index: true,
    },

    pricing: {
      type: pricingSchema,
      default: () => ({}),
    },

    drawingDefaults: {
      type: drawingDefaultsSchema,
      default: () => ({}),
    },

    legacySnapshot: {
      type: Schema.Types.Mixed,
      default: null,
    },

    source: {
      type: sourceSchema,
      default: () => ({}),
    },

    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: "businesscatalogitems",
  },
);

businessCatalogItemSchema.index(
  { businessId: 1, slug: 1 },
  { unique: true, name: "uniq_business_catalog_slug" },
);

businessCatalogItemSchema.index(
  { businessId: 1, "source.collection": 1, "source.legacyId": 1 },
  {
    unique: true,
    sparse: true,
    name: "uniq_business_catalog_legacy_source",
  },
);

module.exports = mongoose.model(
  "BusinessCatalogItem",
  businessCatalogItemSchema,
);
