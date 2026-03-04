// BEGIN CHANGE
const mongoose = require("mongoose");

const MembershipSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },

    role: { type: String, enum: ["owner", "admin", "sales"], default: "owner" },
    status: {
      type: String,
      enum: ["active", "invited", "disabled"],
      default: "active",
    },
  },
  { timestamps: true },
);

MembershipSchema.index({ businessId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("Membership", MembershipSchema);
