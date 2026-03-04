// REPLACE FILE

const mongoose = require("mongoose");

const InviteSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    role: { type: String, enum: ["owner", "admin", "sales"], default: "sales" },

    // store only a hash (never store raw invite tokens)
    tokenHash: { type: String, required: true, index: true },

    expiresAt: { type: Date, required: true, index: true },
    acceptedAt: { type: Date, default: null },

    createdByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
  },
  { timestamps: true },
);

InviteSchema.index({ businessId: 1, email: 1, acceptedAt: 1 });

module.exports = mongoose.model("Invite", InviteSchema);
