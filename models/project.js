const mongoose = require("mongoose");
const validator = require("validator");

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
      accessories: Object,
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
