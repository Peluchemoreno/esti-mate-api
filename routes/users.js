const User = require("../models/user");
const router = require("express").Router();
const authorize = require("../middlewares/auth");

const {
  getCurrentUser,
  signup,
  updateUserInfo,
} = require("../controllers/users");

const multer = require("multer");
const { uploadCompanyLogo, getCompanyLogo } = require("../controllers/users");

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.post("/signup", signup);
router.get("/me", authorize, getCurrentUser);
router.patch("/me", authorize, updateUserInfo);
router.post(
  "/upload-logo",
  authorize,
  upload.single("logo"),
  async (req, res) => {
    const userId = req.user._id;
    const logoBuffer = req.file.buffer;
    const contentType = req.file.mimetype;

    await User.findByIdAndUpdate(userId, {
      logo: { data: logoBuffer, contentType },
    });

    res.status(200).json({ message: "Logo uploaded successfully" });
  }
);
router.get("/:userId/logo", authorize, async (req, res) => {
  const user = await User.findById(req.params.userId);

  if (!user || !user.logo || !user.logo.data) {
    return res.status(404).send("Logo not found");
  }

  res.set("Content-Type", user.logo.contentType);
  res.send(user.logo.data);
});

module.exports = router;
