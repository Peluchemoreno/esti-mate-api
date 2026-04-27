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

const UI_BEHAVIOR_VALUES = ["draw", "derived", "pricing", "hidden", "assembly"];

const TOOL_GROUP_VALUES = [
  "gutters",
  "downspouts",
  "guards",
  "fascia",
  "soffit",
  "roofing",
  "siding",
  "fencing",
  "hvac",
  "annotation",
  "general",
];

const ASSEMBLY_TYPE_VALUES = [
  "none",
  "downspout_v1",
  "gutter_run_v1",
  "custom",
];

const assemblySchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    type: {
      type: String,
      enum: ASSEMBLY_TYPE_VALUES,
      default: "none",
    },
    config: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { _id: false },
);

const BEHAVIOR_ESTIMATION_MODES = ["measured", "manual", "text"];

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
    collection: { type: String, default: undefined },
    legacyId: { type: Schema.Types.ObjectId, default: undefined },
    migratedAt: { type: Date, default: undefined },
    migrationVersion: { type: Number, default: undefined },
  },
  { _id: false },
);

const uiSchema = new Schema(
  {
    group: { type: String, default: "General", trim: true, index: true },
    order: { type: Number, default: 100 },
    iconKey: { type: String, default: null, trim: true },
    badge: { type: String, default: null, trim: true },
    visibleInQuickAdd: { type: Boolean, default: true, index: true },
    visibleInPricing: { type: Boolean, default: true, index: true },
    visibleInDiagram: { type: Boolean, default: true, index: true },
  },
  { _id: false },
);

const behaviorSchema = new Schema(
  {
    estimationMode: {
      type: String,
      enum: BEHAVIOR_ESTIMATION_MODES,
      default: "measured",
    },
    supportsDiagramPlacement: { type: Boolean, default: true },
    supportsFreeformPlacement: { type: Boolean, default: false },
    recommendedTool: {
      type: String,
      enum: BUSINESS_CATALOG_TOOL_FAMILIES,
      default: "point",
    },
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

    uiBehavior: {
      type: String,
      enum: UI_BEHAVIOR_VALUES,
      default: "hidden",
      index: true,
    },

    toolGroup: {
      type: String,
      enum: TOOL_GROUP_VALUES,
      default: "general",
      index: true,
    },

    assembly: {
      type: assemblySchema,
      default: () => ({}),
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

    ui: {
      type: uiSchema,
      default: () => ({}),
    },

    behavior: {
      type: behaviorSchema,
      default: () => ({}),
    },

    legacySnapshot: {
      type: Schema.Types.Mixed,
      default: null,
    },

    source: {
      type: sourceSchema,
      default: undefined,
    },

    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: "businesscatalogitems",
    minimize: true,
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
    name: "uniq_business_catalog_legacy_source",
    partialFilterExpression: {
      "source.collection": { $exists: true, $type: "string" },
      "source.legacyId": { $exists: true, $type: "objectId" },
    },
  },
);

module.exports = mongoose.model(
  "BusinessCatalogItem",
  businessCatalogItemSchema,
);
