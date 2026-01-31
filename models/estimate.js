// models/Estimate.js
const mongoose = require("mongoose");

const estimateItemSchema = new mongoose.Schema(
  {
    name: String,
    quantity: Number,
    price: Number,
  },
  { _id: false }
);

const estimateSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      index: true,
    },
    estimateNumber: { type: Number, index: true }, // sequential per user
    estimateDate: { type: String },
    notes: { type: String },
    items: [estimateItemSchema],
    subtotal: Number,
    total: Number,
    diagram: {
      id: { type: String },
      imageData: { type: String }, // data URL
      lines: { type: Array, default: [] },
      includedPhotoIds: [{ type: String }],
    },
    projectSnapshot: {
      name: String,
      address: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Estimate", estimateSchema);
