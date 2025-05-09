const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcryptjs");

// const userSchema = new mongoose.Schema({
//   name: {
//     type: String,
//     required: true,
//     minlength: 2,
//     maxlength: 30
//   },
//   email: {
//     type: String,
//     required: true,
//     validate: {
//       validator(v){
//         return validator.isEmail(v)
//       },
//       message: "You must enter a valid email address."
//     },
//     unique: true,
//   },
//   password: {
//     type: String,
//     required: true,
//     select: false
//   },
//   logo: {
//     type: Buffer,
//   },
//   subscription: {
//     type: String,
//     required: true,
//     enum: ['unsubscribed', 'basic', 'intermediate', 'pro']
//   }
// })

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  companyName: {
    type: String,
    required: true,
  },
  logo: {
    data: Buffer,
    contentType: String,
  },
  emailVerified: {
    type: Boolean,
    default: false,
  },
  subscriptionPlan: {
    type: String,
    enum: ["free", "basic", "premium"],
    default: "free",
  },
  stripeCustomerId: {
    type: String,
    default: null,
  }, // Stripe customer ID
  stripeSubscriptionId: {
    type: String,
    default: null,
  }, // Active subscription ID
  subscriptionStatus: {
    type: String,
    enum: ["active", "canceled", "trialing"],
    default: "active",
  },
  companyAddress: {
    type: String,
  },
  companyPhone: {
    type: String,
  },
  role: {
    type: String,
    enum: ["admin", "salesperson", "homeowner"],
    required: true,
  },
  createdAt: { type: Date, default: Date.now },
});

userSchema.statics.findUserByCredentials = function findUserByCredentials(
  email,
  password
) {
  return this.findOne({ email })
    .select("+passwordHash")
    .then((user) => {
      if (!user) {
        return Promise.reject(new Error("Incorrect email or password"));
      }
      console.log("user", user);
      return bcrypt.compare(password, user.passwordHash).then((matched) => {
        if (!matched) {
          return Promise.reject(new Error("Incorrect email or password"));
        }
        return user;
      });
    });
};

const User = mongoose.model("user", userSchema);

module.exports = User;
