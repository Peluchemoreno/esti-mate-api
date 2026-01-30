const mongoose = require("mongoose");
const Project = require("../models/project");
const sharp = require("sharp");

// --------------------
// Helpers
// --------------------

async function makePreviewBuffer(originalBuffer, mimetype) {
  // For HEIC/HEIF: sharp can decode if libvips supports it;
  // if not, this will throw and we'll fall back to no preview.
  const img = sharp(originalBuffer, { failOnError: false });

  // Rotate based on EXIF so phone photos aren't sideways
  const pipeline = img.rotate().resize({
    width: 1280, // good mobile/PDF balance
    withoutEnlargement: true,
  });

  // Output format choice:
  // - webp is smaller
  // - png is lossless but huge
  // - jpeg is compatible
  // We'll default to webp for previews.
  return pipeline.webp({ quality: 80 }).toBuffer();
}

function isValidObjectId(id) {
  return mongoose.isValidObjectId(id);
}

function toObjectId(id) {
  try {
    return new mongoose.Types.ObjectId(id);
  } catch (e) {
    return null;
  }
}

function getBucket() {
  const db = mongoose.connection?.db;
  if (!db) {
    throw new Error("Mongo connection not ready (no db handle)");
  }
  // Bucket name is additive; doesn't affect any existing collections
  return new mongoose.mongo.GridFSBucket(db, { bucketName: "projectPhotos" });
}

// Helper: ensure project belongs to current user (LEAN ok for list)
async function getOwnedProject(projectId, userId) {
  if (!isValidObjectId(projectId)) return null;
  return Project.findOne({ _id: projectId, userId }).lean();
}

// Helper: project doc needed for writes
async function getOwnedProjectDoc(projectId, userId) {
  if (!isValidObjectId(projectId)) return null;
  return Project.findOne({ _id: projectId, userId });
}

function photoMetaResponse(p) {
  return {
    id: String(p._id),
    originalMeta: p.originalMeta || {},
    updatedAt: p.updatedAt || p.createdAt,
    hasAnnotations: !!(
      p.annotations &&
      p.annotations.items &&
      p.annotations.items.length
    ),
  };
}

async function listProjectPhotos(req, res, next) {
  try {
    const userId = req.user?._id;
    const { projectId } = req.params;

    if (!userId)
      return res.status(401).json({ message: "Authorization required" });

    const project = await getOwnedProject(projectId, userId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    // Phase 1 scaffold: return metadata only (no files yet)
    const photos = (project.photos || []).map((p) => ({
      id: String(p._id),
      originalMeta: p.originalMeta || {},
      updatedAt: p.updatedAt || p.createdAt,
      hasAnnotations: !!(
        p.annotations &&
        p.annotations.items &&
        p.annotations.items.length
      ),
    }));

    return res.json({ photos });
  } catch (err) {
    return next(err);
  }
}

// --------------------
// Phase 2: real implementations
// --------------------

// POST /dashboard/projects/:projectId/photos
// expects multipart/form-data with field name "photo"
async function createProjectPhoto(req, res, next) {
  try {
    const userId = req.user?._id;
    const { projectId } = req.params;

    if (!userId)
      return res.status(401).json({ message: "Authorization required" });

    if (!req.file || !req.file.buffer) {
      return res
        .status(400)
        .json({ error: "Missing photo file (field: photo)" });
    }

    const project = await getOwnedProjectDoc(projectId, userId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const bucket = getBucket();

    const filename = req.file.originalname || `project-photo-${Date.now()}`;
    const uploadStream = bucket.openUploadStream(filename, {
      contentType: req.file.mimetype,
      metadata: {
        userId: String(userId),
        projectId: String(projectId),
        kind: "original",
      },
    });

    // write buffer -> GridFS
    const fileId = await new Promise((resolve, reject) => {
      uploadStream.on("finish", () => resolve(uploadStream.id));
      uploadStream.on("error", reject);
      uploadStream.end(req.file.buffer);
    });

    let previewFileId = null;

    try {
      const previewBuf = await makePreviewBuffer(
        req.file.buffer,
        req.file.mimetype
      );

      const previewStream = bucket.openUploadStream(`preview-${filename}`, {
        contentType: "image/webp",
        metadata: {
          userId: String(userId),
          projectId: String(projectId),
          kind: "preview",
          sourceOriginalFileId: String(fileId),
        },
      });

      previewFileId = await new Promise((resolve, reject) => {
        previewStream.on("finish", () => resolve(previewStream.id));
        previewStream.on("error", reject);
        previewStream.end(previewBuf);
      });
    } catch (e) {
      // Preview generation is best-effort.
      // We still succeed the upload even if preview fails.
      previewFileId = null;
    }

    const now = new Date();

    // Append photo subdoc (schema already has these fields)
    project.photos.push({
      originalFileId: String(fileId),
      previewFileId: previewFileId ? String(previewFileId) : null,

      originalMeta: {
        filename: req.file.originalname || null,
        mime: req.file.mimetype || null,
        width: null,
        height: null,
        takenAt: null,
      },
      annotations: {
        version: 1,
        items: [],
        updatedAt: null,
      },
      createdAt: now,
      updatedAt: now,
    });

    await project.save();

    const saved = project.photos[project.photos.length - 1];
    return res.status(201).json({ photo: photoMetaResponse(saved) });
  } catch (err) {
    return next(err);
  }
}

// GET /dashboard/projects/:projectId/photos/:photoId
async function getProjectPhotoMeta(req, res, next) {
  try {
    const userId = req.user?._id;
    const { projectId, photoId } = req.params;

    if (!userId)
      return res.status(401).json({ message: "Authorization required" });

    const project = await getOwnedProjectDoc(projectId, userId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const p = (project.photos || []).id(photoId);
    if (!p) return res.status(404).json({ error: "Photo not found" });

    return res.json({ photo: photoMetaResponse(p) });
  } catch (err) {
    return next(err);
  }
}

// PATCH /dashboard/projects/:projectId/photos/:photoId
// body: { items: [...] }  (or { annotations: { items: [...] } })
async function updateProjectPhotoAnnotations(req, res, next) {
  try {
    const userId = req.user?._id;
    const { projectId, photoId } = req.params;

    if (!userId)
      return res.status(401).json({ message: "Authorization required" });

    const project = await getOwnedProjectDoc(projectId, userId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const p = (project.photos || []).id(photoId);
    if (!p) return res.status(404).json({ error: "Photo not found" });

    const items =
      (req.body && Array.isArray(req.body.items) && req.body.items) ||
      (req.body &&
        req.body.annotations &&
        Array.isArray(req.body.annotations.items) &&
        req.body.annotations.items) ||
      null;

    if (!items) {
      return res.status(400).json({ error: "Missing annotations items" });
    }

    // Keep schema stable: write into existing annotations subdoc
    p.annotations = p.annotations || { version: 1, items: [], updatedAt: null };
    p.annotations.items = items;
    p.annotations.updatedAt = new Date();
    p.updatedAt = new Date();

    await project.save();
    return res.json({ photo: photoMetaResponse(p) });
  } catch (err) {
    return next(err);
  }
}

// GET /dashboard/projects/:projectId/photos/:photoId/image?variant=original|preview
async function streamProjectPhotoImage(req, res, next) {
  try {
    const userId = req.user?._id;
    const { projectId, photoId } = req.params;
    const variant = (req.query.variant || "original").toString();

    if (!userId)
      return res.status(401).json({ message: "Authorization required" });

    const project = await getOwnedProjectDoc(projectId, userId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const p = (project.photos || []).id(photoId);
    if (!p) return res.status(404).json({ error: "Photo not found" });

    const fileIdStr =
      variant === "preview" ? p.previewFileId : p.originalFileId;

    if (!fileIdStr) {
      return res.status(404).json({ error: "Photo file not available" });
    }

    const fileId = toObjectId(fileIdStr);
    if (!fileId) return res.status(400).json({ error: "Invalid file id" });

    const bucket = getBucket();

    // fetch file metadata to set headers
    const files = await bucket.find({ _id: fileId }).toArray();
    const file = files && files[0];
    if (!file) return res.status(404).json({ error: "File not found" });

    res.setHeader(
      "Content-Type",
      file.contentType || "application/octet-stream"
    );
    res.setHeader("Content-Length", String(file.length || ""));
    // Inline display in browser
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${file.filename || "photo"}"`
    );

    const downloadStream = bucket.openDownloadStream(fileId);
    downloadStream.on("error", (e) => next(e));
    downloadStream.pipe(res);
  } catch (err) {
    return next(err);
  }
}

// DELETE /dashboard/projects/:projectId/photos/:photoId
async function deleteProjectPhoto(req, res, next) {
  try {
    const userId = req.user?._id;
    const { projectId, photoId } = req.params;

    if (!userId)
      return res.status(401).json({ message: "Authorization required" });

    const project = await getOwnedProjectDoc(projectId, userId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const p = (project.photos || []).id(photoId);
    if (!p) return res.status(404).json({ error: "Photo not found" });

    const bucket = getBucket();

    const idsToDelete = [p.originalFileId, p.previewFileId].filter(Boolean);

    // Remove subdoc from project first (so metadata is gone even if GridFS cleanup fails)
    project.photos.pull({ _id: p._id });
    await project.save();

    // Best-effort GridFS deletion (safe to attempt after metadata removal)
    await Promise.all(
      idsToDelete.map(async (idStr) => {
        const oid = toObjectId(idStr);
        if (!oid) return;
        await new Promise((resolve) => {
          bucket.delete(oid, () => resolve()); // ignore errors intentionally
        });
      })
    );

    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listProjectPhotos,
  createProjectPhoto,
  getProjectPhotoMeta,
  updateProjectPhotoAnnotations,
  streamProjectPhotoImage,
  deleteProjectPhoto,
};
