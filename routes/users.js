const router = require("express").Router();
const authorize = require("../middlewares/auth");

const { getCurrentUser, createUser } = require("../controllers/users");

const multer = require("multer");
const { uploadCompanyLogo, getCompanyLogo } = require("../controllers/users");

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.post("/signup", createUser);
router.get("/me", authorize, getCurrentUser);
router.post(
  "/upload-logo",
  authorize,
  upload.single("logo"),
  uploadCompanyLogo
);
router.get("/:userId/logo", authorize, getCompanyLogo);

module.exports = router;
