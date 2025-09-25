// models/Counter.js
const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // e.g. `user:<userId>:est`
    seq: { type: Number, default: 0 },
  },
  { versionKey: false }
);

module.exports = mongoose.model("Counter", counterSchema);
