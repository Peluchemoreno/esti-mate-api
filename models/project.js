const mongoose = require("mongoose");
const validator = require("validator");

// --------------------
// NEW: Photo Annotations (Phase 1 scaffolding)
// --------------------
const PhotoAnnotationItemSchema = new mongoose.Schema(
  {
    id: { type: String, required: true }, // uuid from client
    type: {
      type: String,
      enum: ["line", "rect", "circle", "x", "text"],
      required: true,
    },
    stroke: { type: String, default: "#000000" },
    strokeWidth: { type: Number, default: 2 },
    fill: { type: String, default: null }, // for filled shapes
    opacity: { type: Number, default: 1 },

    // geometry (we keep optional keys; client sends only what applies)
    p1: { x: Number, y: Number },
    p2: { x: Number, y: Number },

    x: Number,
    y: Number,
    w: Number,
    h: Number,

    cx: Number,
    cy: Number,
    r: Number,

    text: String,
    fontSize: { type: Number, default: 16 },
  },
  { _id: false, strict: false, minimize: false }
);

const ProjectPhotoSchema = new mongoose.Schema(
  {
    originalFileId: { type: String, default: null }, // GridFS id (stringified)
    previewFileId: { type: String, default: null }, // GridFS id (stringified)

    originalMeta: {
      filename: { type: String, default: null },
      mime: { type: String, default: null },
      width: { type: Number, default: null },
      height: { type: Number, default: null },
      takenAt: { type: Date, default: null },
    },

    annotations: {
      version: { type: Number, default: 1 },
      items: { type: [PhotoAnnotationItemSchema], default: [] },
      updatedAt: { type: Date, default: null },
    },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { minimize: false }
);

// NEW: meta subdoc for accessories (strict false = keep any future keys)
const AccessoryMetaSchema = new mongoose.Schema(
  {
    kind: { type: String }, // 'miter' | 'endCap' | 'elbow' | 'offset'
    type: { type: String }, // 'Strip' | 'Bay' | 'Custom'  (server canonical)
    miterType: { type: String }, // if client sends this, we keep it too
    degrees: { type: Number }, // for custom miter
    code: { type: String }, // 'A' | 'B' (elbows)
    inches: { type: String }, // '2' | '4' | '6' (offsets)
    size: { type: String }, // '2x3' | '3x4' | '3"' | '4"'
    profileKey: { type: String }, // e.g. 5" K-Style
  },
  { _id: false, strict: false, minimize: false }
);

// NEW: accessory line item schema
const AccessoryItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
    product: { type: Object, required: true },
    meta: { type: AccessoryMetaSchema, default: {} },
  },
  { _id: false, strict: true, minimize: false }
);

const projectSchema = new mongoose.Schema({
  projectName: {
    type: String,
    required: true,
    minlength: 1,
    maxlength: 60,
  },
  billingName: {
    type: String,
    required: true,
    minlength: 1,
    maxlength: 60,
  },
  billingAddress: {
    type: String,
    required: true,
  },
  billingPrimaryPhone: {
    type: String,
    required: true,
  },
  billingSecondaryPhone: {
    type: String,
  },
  billingEmail: {
    type: String,
    validate: {
      validator(v) {
        return validator.isEmail(v);
      },
      message: "You must enter a valid email address.",
    },
  },
  siteName: {
    type: String,
    required: true,
  },
  siteAddress: {
    type: String,
    required: true,
  },
  sitePrimaryPhone: {
    type: String,
    required: true,
  },
  siteSecondaryPhone: {
    type: String,
  },
  siteEmail: {
    type: String,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now(),
  },
  diagrams: [
    {
      lines: Array,
      imageData: String,
      totalFootage: Number,
      price: String,
      accessoryData: Array,
      accessories: {
        items: { type: [AccessoryItemSchema], default: [] },
      },
      product: Object,
      elbowsBySize: Object,
      elbowLineItems: Array,
      endCapsByProduct: Object,
      mitersByProduct: Object,
      mixedMiters: Array,
      createdAt: { type: String, default: new Date().toLocaleString() },
      // NEW: photo ids (Project.photos._id) to include in PDF for this diagram
      includedPhotoIds: { type: [String], default: [] },
    },
  ],
  photos: { type: [ProjectPhotoSchema], default: [] },
});

const Project = mongoose.model("project", projectSchema);

module.exports = Project;
