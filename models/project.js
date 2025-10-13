const mongoose = require("mongoose");
const validator = require("validator");

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
    },
  ],
});

const Project = mongoose.model("project", projectSchema);

module.exports = Project;
