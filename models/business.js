const mongoose = require("mongoose");

const BusinessSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    // Stage 0: "personal" businesses are invisible to solo users.
    kind: { type: String, enum: ["personal", "team"], default: "personal" },

    createdByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },

    // keep flexible, avoid over-modeling early
    settings: { type: Object, default: {} },
  },
  { timestamps: true },
);

// helpful for idempotent-ish personal business behavior
BusinessSchema.index({ createdByUserId: 1, kind: 1 });

module.exports = mongoose.model("Business", BusinessSchema);
