const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { ensureUserCatalog } = require("../services/productCopyService.js");
const User = require("../models/user");
const IncorrectEmailOrPasswordError = require("../errors/IncorrectEmailOrPassword.js");

async function signup(req, res, next) {
  try {
    console.log("create a user running.");

    const {
      firstName,
      lastName,
      email,
      password,
      companyName,
      companyAddress,
      companyPhone,
    } = req.body;

    // 1) Prevent duplicate email first
    const existing = await User.findOne({
      email: email.toLowerCase().trim(),
    }).lean();
    if (existing) {
      return res.status(409).json({ message: "Please use a different email" });
    }

    // 2) Create the user
    console.log("creating the user, as no user was found");
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      fullName: `${String(firstName).trim()} ${String(lastName).trim()}`,
      email: email.toLowerCase().trim(),
      passwordHash,
      companyName,
      companyAddress,
      companyPhone,
      role: "admin",
      subscriptionPlan: "free",
      subscriptionStatus: "disabled",
      emailVerified: false,
    });

    // 3) Safety: ensure we have an id
    if (!user || !user._id) {
      console.error("signup: created user has no _id, aborting catalog seed");
      return res.status(500).json({ message: "Failed to create user" });
    }

    // 4) Seed that user's catalog (await it, and PASS _id)
    try {
      await ensureUserCatalog(user._id);
    } catch (seedErr) {
      // Log but do not fail signup—let the user in; you can re-run seeding later if needed
      console.error("ensureUserCatalog failed for user %s:", user._id, seedErr);
    }

    // 5) Issue JWT (if you do that here; if Stripe will replace later, fine)
    const token = jwt.sign(
      { _id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      message: "User created",
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        companyName: user.companyName,
        companyAddress: user.companyAddress,
        companyPhone: user.companyPhone,
        role: user.role,
      },
      token,
    });
  } catch (err) {
    // If email uniqueness in DB fires here, normalize the message
    if (err && err.code === 11000 && err.keyPattern && err.keyPattern.email) {
      return res.status(409).json({ message: "Please use a different email" });
    }
    return next(err);
  }
}

function login(req, res, next) {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new Error("Invalid data entered"));
  }

  return User.findUserByCredentials(email, password)
    .then((user) => {
      const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, {
        expiresIn: "7d",
      });
      res.send({ token });
    })
    .catch((err) => {
      if (err.message === "Incorrect email or password") {
        return next(IncorrectEmailOrPasswordError);
      }
      return next(err);
    });
}

function getCurrentUser(req, res, next) {
  const { _id } = req.user;

  User.findById(_id)
    .orFail()
    .then((user) => {
      res.send(user);
    })
    .catch((err) => {
      if (err.name === "DocumentNotFoundError") {
        return next(new Error("Requested resource not found."));
      }
      return next(err);
    });
}

const uploadCompanyLogo = async (req, res) => {
  try {
    const { _id } = req.user;

    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      _id,
      {
        logo: {
          data: file.buffer,
          contentType: file.mimetype,
        },
      },
      { new: true }
    );

    res.json({ message: "Logo uploaded", user: updatedUser });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Failed to upload logo" });
  }
};

// Serve logo image
const getCompanyLogo = async (req, res) => {
  const { _id } = req.user;
  try {
    const user = await User.findById(_id);
    if (!user || !user.logo || !user.logo.data) {
      return res.status(404).send("Logo not found");
    }

    res.set("Content-Type", user.logo.contentType);
    res.send(user.logo.data);
  } catch (err) {
    console.error("Fetch logo error:", err);
    res.status(500).send("Error retrieving logo");
  }
};

function updateUserInfo(req, res, next) {
  const { _id } = req.user;
  const { companyName, companyPhoneNumber, companyAddress, logo } = req.body;
  User.findByIdAndUpdate(
    _id,
    { companyName, companyAddress, companyPhone: companyPhoneNumber },
    { new: true }
  )
    .orFail()
    .then((data) => {
      res.send(data);
    })
    .catch((err) => {
      return next(err);
    });
}

module.exports = {
  signup,
  login,
  getCurrentUser,
  uploadCompanyLogo,
  getCompanyLogo,
  updateUserInfo,
};
