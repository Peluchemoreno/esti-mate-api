const mongoose = require("mongoose");
const validator = require("validator");

const CustomerIntegrationSchema = new mongoose.Schema(
  {
    provider: { type: String, default: null }, // e.g. 'jobber'
    externalId: { type: String, default: null },
    syncedAt: { type: Date, default: null },
  },
  { _id: false, minimize: false },
);

const customerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      index: true,
      default: null,
    },

    type: {
      type: String,
      enum: ["builder", "homeowner"],
      required: true,
      default: "homeowner",
    },

    // required: name only
    name: { type: String, required: true, trim: true, maxlength: 120 },

    // optional
    companyName: { type: String, default: null, trim: true, maxlength: 160 },
    phone: { type: String, default: null, trim: true, maxlength: 40 },
    email: {
      type: String,
      default: null,
      trim: true,
      validate: {
        validator(v) {
          if (v === null || v === undefined || v === "") return true;
          return validator.isEmail(String(v));
        },
        message: "You must enter a valid email address.",
      },
    },

    // future Jobber import fields
    integration: { type: CustomerIntegrationSchema, default: {} },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { minimize: false },
);

customerSchema.index({ userId: 1, name: 1 });

customerSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

const Customer = mongoose.model("customer", customerSchema);
module.exports = Customer;
