// models/UserGutterProduct.js
const mongoose = require("mongoose");

const UserGutterProductSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "GutterProductTemplate",
  },
  name: String,
  price: Number,
  listed: Boolean,
  description: String,
  colorCode: String,
  removalPricePerFoot: Number,
  unit: String,
  gutterGuardOptions: [
    {
      name: String,
      price: Number,
      unit: String, // usually 'foot'
    },
  ],
  profile: String,
  type: String,
  size: String,
  isDownspout: Boolean,
  canWrapFascia: Boolean,
  canReplaceFascia: Boolean,
  canBeRemoved: Boolean,
  supportsGutterGuard: Boolean,
  canReplace1x2: Boolean,
  hasElbows: Boolean,
}, {timestamps: true});

module.exports = mongoose.model("UserGutterProduct", UserGutterProductSchema);
