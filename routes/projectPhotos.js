const express = require("express");
const router = express.Router({ mergeParams: true });

const multer = require("multer");

const {
  listProjectPhotos,
  createProjectPhoto,
  getProjectPhotoMeta,
  updateProjectPhotoAnnotations,
  streamProjectPhotoImage,
  createProjectPhotosBulk,
  deleteProjectPhoto,
} = require("../controllers/projectPhotos");

// Phase 2: multer memory storage (no disk writes)
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 12 * 1024 * 1024, // 12MB per photo (tune later)
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const ok = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
    ]);
    if (!ok.has(file.mimetype)) {
      return cb(new Error("Invalid file type. Only images are allowed."));
    }
    return cb(null, true);
  },
});

const uploadBulk = multer({
  storage,
  limits: {
    fileSize: 12 * 1024 * 1024, // same per-photo max as today
    files: 10, // ✅ max 10 per request
  },
  fileFilter: (req, file, cb) => {
    const ok = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
    ]);
    if (!ok.has(file.mimetype)) {
      return cb(new Error("Invalid file type. Only images are allowed."));
    }
    return cb(null, true);
  },
});

// (keep your debug logger if you want)
router.use((req, res, next) => {
  console.log(
    "[projectPhotos] baseUrl=",
    req.baseUrl,
    "path=",
    req.path,
    "params=",
    req.params
  );
  next();
});

router.get("/", listProjectPhotos);

// Phase 2 real endpoints (still safe: UI isn't calling them yet)
router.post("/", upload.single("photo"), createProjectPhoto);
router.get("/:photoId", getProjectPhotoMeta);
router.patch("/:photoId", updateProjectPhotoAnnotations);
router.get("/:photoId/image", streamProjectPhotoImage);
router.delete("/:photoId", deleteProjectPhoto);
// ✅ new (additive)
router.post("/bulk", uploadBulk.array("photos", 10), createProjectPhotosBulk);

// Multer error handling (keeps API clean instead of crashing / generic 500)
router.use((err, req, res, next) => {
  // Multer uses err.code for limits
  if (err && err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "File too large" });
  }
  if (err && err.message && err.message.includes("Invalid file type")) {
    return res.status(415).json({ error: err.message });
  }
  return next(err);
});

module.exports = router;
