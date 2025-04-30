const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const JWT_SECRET = require("../utils/config");

const User = require("../models/user");

function createUser(req, res, next) {
  const {
    firstName,
    lastName,
    email,
    password,
    companyName,
    companyAddress,
    companyPhone,
  } = req.body;

  User.findOne({ email })
    .then((user) => {
      if (user) {
        throw new Error("Please use a different email");
      }
      return bcrypt.hash(password, 10);
    })
    .then((hash) => {
      User.create({
        fullName: `${firstName} ${lastName}`,
        email: email,
        passwordHash: hash,
        companyName,
        companyAddress,
        companyPhone,
        role: "admin",
      }).then((user) => {
        res.send({
          email: user.email,
          name: user.name,
        });
      });
    })

    .catch((err) => {
      if (err.name === "ValidationError") {
        return next(new Error("Invalid data sent"));
      }
      if (err.name === "InvalidEmailError") {
        return next(new Error("Please try a different email address."));
      }
      return next(err);
    });
}

function login(req, res, next) {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new Error("Invalid data entered"));
  }

  return User.findUserByCredentials(email, password)
    .then((user) => {
      const token = jwt.sign({ _id: user._id }, JWT_SECRET, {
        expiresIn: "7d",
      });
      res.send({ token });
    })
    .catch((err) => {
      if (err.message === "Incorrect email or password") {
        return next(new Error("Incorrect email or password"));
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
  createUser,
  login,
  getCurrentUser,
  uploadCompanyLogo,
  getCompanyLogo,
  updateUserInfo,
};
