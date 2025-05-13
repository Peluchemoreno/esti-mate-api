const mongoose = require("mongoose");

const GutterProductTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ["gutter", "downspout", "accessory", "guard"],
      required: true,
    },
    profile: { type: String }, // e.g., 'k-style', 'box', 'round'
    size: { type: String }, // e.g., '5"', '6"'
    description: { type: String },
    defaultColor: { type: String, default: "#000000" },
    defaultUnit: { type: String, enum: ["foot", "unit"], default: "foot" },

    // Feature toggles
    canWrapFascia: { type: Boolean, default: false },
    canReplaceFascia: { type: Boolean, default: false },
    canReplace1x2: { type: Boolean, default: false },
    canBeRemoved: { type: Boolean, default: false },
    canBeRepaired: { type: Boolean, default: false },

    // Gutter Guard capability (not guard options themselves)
    supportsGutterGuard: { type: Boolean, default: false },

    // Downspout-specific metadata
    isDownspout: { type: Boolean, default: false },
    hasElbows: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "GutterProductTemplate",
  GutterProductTemplateSchema
);
