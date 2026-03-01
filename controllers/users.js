const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { ensureUserCatalog } = require("../services/productCopyService.js");
const User = require("../models/user");
const IncorrectEmailOrPasswordError = require("../errors/IncorrectEmailOrPassword.js");
const crypto = require("crypto");
const { sendPasswordResetEmail } = require("../utils/sendgrid");
const { generateResetToken } = require("../utils/passwordReset");

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
      { expiresIn: "7d" },
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
  console.log("user logging in");
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new Error("Invalid data entered"));
  }

  return User.findUserByCredentials(email, password)
    .then((user) => {
      const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, {
        expiresIn: "7d",
      });
      res.send({ token, mustChangePassword: user.mustChangePassword });
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
      { new: true },
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
    { new: true },
  )
    .orFail()
    .then((data) => {
      res.send(data);
    })
    .catch((err) => {
      return next(err);
    });
}

// POST /forgot-password
async function forgotPassword(req, res) {
  const email = String(req.body.email || "")
    .toLowerCase()
    .trim();

  // Always respond success
  res.json({
    message: "If an account exists, a reset email has been sent.",
  });

  const user = await User.findOne({ email });
  if (!user) return;

  const { rawToken, tokenHash } = generateResetToken();

  user.passwordResetTokenHash = tokenHash;
  user.passwordResetExpiresAt = new Date(Date.now() + 45 * 60 * 1000);

  await user.save();

  const resetLink = `${
    process.env.FRONTEND_BASE_URL
  }/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`;

  try {
    await sendPasswordResetEmail(email, resetLink);
  } catch (err) {
    console.error("SendGrid error:", err);
  }
}

// POST /reset-password
async function resetPassword(req, res) {
  const { email, token, newPassword } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(400).json({ message: "Invalid or expired reset link." });
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  if (
    !user.passwordResetTokenHash ||
    user.passwordResetTokenHash !== tokenHash ||
    !user.passwordResetExpiresAt ||
    user.passwordResetExpiresAt.getTime() < Date.now()
  ) {
    return res.status(400).json({ message: "Invalid or expired reset link." });
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.passwordResetTokenHash = null;
  user.passwordResetExpiresAt = null;
  user.passwordChangedAt = new Date();

  await user.save();

  res.json({ message: "Password successfully reset." });
}

// ADMIN: Reset user password (temporary)
async function adminResetUserPassword(req, res) {
  if (req.user.email !== "jmcdmoreno19@aol.com") {
    return res.status(403).json({ message: "Forbidden" });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email required" });
  }

  const user = await User.findOne({ email });

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  // generate temporary password
  const tempPassword = Math.random().toString(36).slice(-12);

  const hash = await bcrypt.hash(tempPassword, 10);

  user.passwordHash = hash;
  user.mustChangePassword = true;

  await user.save();

  // IMPORTANT: only YOU see this
  return res.json({
    temporaryPassword: tempPassword,
    message:
      "Temporary password generated. User must change password on login.",
  });
}

// USER: Change own password
async function changePassword(req, res) {
  try {
    const userId = req.user && req.user._id;
    const { currentPassword, newPassword } = req.body || {};

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (
      !newPassword ||
      typeof newPassword !== "string" ||
      newPassword.length < 8
    ) {
      return res
        .status(400)
        .json({ message: "New password must be at least 8 characters." });
    }

    // Ensure we have passwordHash available
    const user = await User.findById(userId).select("+passwordHash");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // mustChangePassword might be undefined for older users; treat undefined as false
    const mustChange = user.mustChangePassword === true;

    // If user is NOT in forced-change mode, require current password
    if (!mustChange) {
      if (!currentPassword || typeof currentPassword !== "string") {
        return res
          .status(400)
          .json({ message: "Current password is required." });
      }

      const match = await bcrypt.compare(currentPassword, user.passwordHash);

      if (!match) {
        return res.status(401).json({ message: "Current password incorrect" });
      }
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.mustChangePassword = false;
    await user.save();

    return res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("changePassword error:", err);
    return res.status(500).json({ message: "Server error" });
  }
} // USER: Change own password
async function changePassword(req, res) {
  const userId = req.user._id;
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(userId).select("+passwordHash");

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  // If not forced, require current password
  if (!user.mustChangePassword) {
    const match = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!match) {
      return res.status(401).json({ message: "Current password incorrect" });
    }
  }

  const newHash = await bcrypt.hash(newPassword, 10);

  user.passwordHash = newHash;
  user.mustChangePassword = false;

  await user.save();

  res.json({ message: "Password updated successfully" });
}

module.exports = {
  signup,
  login,
  getCurrentUser,
  uploadCompanyLogo,
  getCompanyLogo,
  updateUserInfo,
  changePassword,
  adminResetUserPassword,
  forgotPassword,
  resetPassword,
};
