const mongoose = require("mongoose");
const Project = require("../models/project");
const sharp = require("sharp");

// --------------------
// Helpers
// --------------------

async function makePreviewBuffer(originalBuffer) {
  // Rotate based on EXIF so phone photos aren't sideways
  return (
    sharp(originalBuffer, { failOnError: false })
      .rotate()
      // Prevent ultra-wide/ultra-tall weirdness: keep inside a box
      .resize({
        width: 1280,
        height: 1280,
        fit: "inside",
        withoutEnlargement: true,
      })
      // Remove alpha so previews never appear “transparent”
      .flatten({ background: "#ffffff" })
      // JPEG is the safest for PDF/image pipelines
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer()
  );
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
    originalMeta: p.originalMeta,
    updatedAt: p.updatedAt,
    hasAnnotations: Boolean(p.annotations?.items?.length),

    // ✅ THIS IS THE KEY
    annotations: p.annotations || {
      version: 1,
      items: [],
      updatedAt: null,
    },
  };
}

function photoMetaResponseWithAnnotations(p) {
  return {
    ...photoMetaResponse(p),
    annotations: p.annotations || { version: 1, items: [], updatedAt: null },
  };
}

async function listProjectPhotos(req, res, next) {
  try {
    const userId = req.user?._id; // ✅ FIX: define userId
    const { projectId } = req.params;

    if (!userId) {
      return res.status(401).json({ message: "Authorization required" });
    }

    const project = await getOwnedProject(projectId, userId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    // Return metadata only (fast). Keep existing shape.
    const photos = (project.photos || []).map((p) => ({
      id: String(p._id),
      originalMeta: p.originalMeta || {},
      updatedAt: p.updatedAt || p.createdAt,
      hasAnnotations: !!p.annotations?.items?.length,
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
      const previewBuf = await makePreviewBuffer(req.file.buffer);

      const previewStream = bucket.openUploadStream(`preview-${filename}.jpg`, {
        contentType: "image/jpeg",
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

// controllers/projectPhotos.js

// POST /dashboard/projects/:projectId/photos/bulk
// expects multipart/form-data with field name "photos" (up to 10)
async function createProjectPhotosBulk(req, res, next) {
  try {
    const userId = req.user?._id;
    const { projectId } = req.params;

    if (!userId)
      return res.status(401).json({ message: "Authorization required" });

    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) {
      return res
        .status(400)
        .json({ error: "Missing photo files (field: photos)" });
    }

    const project = await getOwnedProjectDoc(projectId, userId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const bucket = getBucket();
    const now = new Date();

    // We'll collect results per file, and only push successful photos into the project.
    const results = [];
    const createdSubdocs = []; // mongoose subdocs we push, so we can return ids after save
    const createdGridFsIds = []; // best-effort cleanup if project.save() fails

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const filename = f.originalname || `project-photo-${Date.now()}-${i}`;

      // default per-file response shell
      const r = { index: i, filename, ok: false };

      let originalFileId = null;
      let previewFileId = null;

      try {
        if (!f || !f.buffer) {
          r.error = "Missing file buffer";
          results.push(r);
          continue;
        }

        // 1) upload original -> GridFS
        const uploadStream = bucket.openUploadStream(filename, {
          contentType: f.mimetype,
          metadata: {
            userId: String(userId),
            projectId: String(projectId),
            kind: "original",
          },
        });

        originalFileId = await new Promise((resolve, reject) => {
          uploadStream.on("finish", () => resolve(uploadStream.id));
          uploadStream.on("error", reject);
          uploadStream.end(f.buffer);
        });

        // 2) best-effort preview
        try {
          const previewBuf = await makePreviewBuffer(f.buffer);

          const previewStream = bucket.openUploadStream(
            `preview-${filename}.jpg`,
            {
              contentType: "image/jpeg",
              metadata: {
                userId: String(userId),
                projectId: String(projectId),
                kind: "preview",
                sourceOriginalFileId: String(originalFileId),
              },
            }
          );

          previewFileId = await new Promise((resolve, reject) => {
            previewStream.on("finish", () => resolve(previewStream.id));
            previewStream.on("error", reject);
            previewStream.end(previewBuf);
          });
        } catch (e) {
          previewFileId = null; // ok
        }

        // 3) Create mongoose subdoc, but DO NOT save yet
        const subdoc = project.photos.create({
          originalFileId: String(originalFileId),
          previewFileId: previewFileId ? String(previewFileId) : null,

          originalMeta: {
            filename: f.originalname || null,
            mime: f.mimetype || null,
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

        project.photos.push(subdoc);
        createdSubdocs.push(subdoc);

        // track for cleanup if save fails
        createdGridFsIds.push(String(originalFileId));
        if (previewFileId) createdGridFsIds.push(String(previewFileId));

        r.ok = true;
        // we'll attach the final "photo meta" after save
        results.push(r);
      } catch (err) {
        // Best-effort cleanup for THIS file’s GridFS objects (avoid orphaned files)
        try {
          const ids = [originalFileId, previewFileId].filter(Boolean);
          await Promise.all(
            ids.map(async (id) => {
              const oid = toObjectId(String(id));
              if (!oid) return;
              await new Promise((resolve) =>
                bucket.delete(oid, () => resolve())
              );
            })
          );
        } catch (_) {
          // ignore cleanup errors intentionally
        }

        r.error = err?.message || "Upload failed";
        results.push(r);
      }
    }

    // If we created at least one photo subdoc, persist project once
    if (createdSubdocs.length) {
      try {
        await project.save();
      } catch (saveErr) {
        // If saving the project fails, clean up all created GridFS files best-effort
        try {
          await Promise.all(
            createdGridFsIds.map(async (idStr) => {
              const oid = toObjectId(idStr);
              if (!oid) return;
              await new Promise((resolve) =>
                bucket.delete(oid, () => resolve())
              );
            })
          );
        } catch (_) {
          // ignore cleanup errors intentionally
        }
        return next(saveErr);
      }

      // After save, fill in the returned photo meta for ok results
      // createdSubdocs are the exact subdocs we pushed, now with _id.
      let k = 0;
      for (let i = 0; i < results.length; i++) {
        if (results[i].ok) {
          const sd = createdSubdocs[k++];
          results[i].photo = photoMetaResponse(sd);
        }
      }
    }

    return res.status(200).json({
      ok: true,
      results,
      summary: {
        total: results.length,
        success: results.filter((x) => x.ok).length,
        failed: results.filter((x) => !x.ok).length,
      },
    });
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
    if (!mongoose.isValidObjectId(projectId)) {
      return res.status(400).json({ error: "Invalid projectId" });
    }
    if (!mongoose.isValidObjectId(photoId)) {
      return res.status(400).json({ error: "Invalid photoId" });
    }

    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) return res.status(404).json({ error: "Project not found" });

    const photo = (project.photos || []).id(photoId);
    if (!photo) return res.status(404).json({ error: "Photo not found" });

    // ✅ always include annotations.items
    return res.json({ photo: photoMetaResponse(photo) });
  } catch (err) {
    return next(err);
  }
}

// PATCH /dashboard/projects/:projectId/photos/:photoId
async function updateProjectPhotoAnnotations(req, res, next) {
  try {
    const userId = req.user?._id;
    const { projectId, photoId } = req.params;

    if (!userId)
      return res.status(401).json({ message: "Authorization required" });
    if (!mongoose.isValidObjectId(projectId)) {
      return res.status(400).json({ error: "Invalid projectId" });
    }
    if (!mongoose.isValidObjectId(photoId)) {
      return res.status(400).json({ error: "Invalid photoId" });
    }

    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) return res.status(404).json({ error: "Project not found" });

    const photo = (project.photos || []).id(photoId);
    if (!photo) return res.status(404).json({ error: "Photo not found" });

    const incoming =
      (Array.isArray(req.body?.items) && req.body.items) ||
      (Array.isArray(req.body?.annotations?.items) &&
        req.body.annotations.items) ||
      [];

    // ✅ enforce minimum validity: must have id + type (schema requires type)
    const cleaned = (Array.isArray(incoming) ? incoming : [])
      .filter((it) => it && typeof it === "object")
      .map((it) => ({
        ...it,
        type: it.type || it.kind, // tolerate client sending kind
        id: it.id ? String(it.id) : undefined,
      }))
      .filter((it) => it.id && it.type);

    if (!photo.annotations) {
      photo.annotations = { version: 1, items: [], updatedAt: null };
    }

    photo.annotations.items = cleaned;
    photo.annotations.updatedAt = new Date();
    photo.updatedAt = new Date();

    // ✅ ensure mongoose persists nested changes
    project.markModified("photos");

    await project.save();

    return res.json({
      ok: true,
      photo: photoMetaResponse(photo),
    });
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

// controllers/projectPhotos.js

async function deleteProjectPhoto(req, res, next) {
  try {
    const userId = req.user?._id;
    const { projectId, photoId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const project = await getOwnedProjectDoc(projectId, userId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const photo = project.photos.id(photoId);
    if (!photo) {
      return res.status(404).json({ error: "Photo not found" });
    }

    const bucket = getBucket();

    // --- 1. delete GridFS files (best-effort) ---
    const gridIds = [photo.originalFileId, photo.previewFileId].filter(Boolean);

    for (const id of gridIds) {
      try {
        const oid = toObjectId(String(id));
        if (!oid) continue;
        await new Promise((resolve) => bucket.delete(oid, () => resolve()));
      } catch (_) {
        // intentionally ignore (orphan cleanup best-effort)
      }
    }

    // --- 2. remove photo from project.photos ---
    photo.remove();

    // --- 3. remove from ALL diagrams ---
    let removedFromDiagrams = 0;
    project.diagrams.forEach((d) => {
      if (!Array.isArray(d.includedPhotoIds)) return;
      const before = d.includedPhotoIds.length;
      d.includedPhotoIds = d.includedPhotoIds.filter(
        (id) => String(id) !== String(photoId)
      );
      if (d.includedPhotoIds.length !== before) {
        removedFromDiagrams++;
      }
    });

    await project.save();

    return res.json({
      ok: true,
      deletedPhotoId: photoId,
      removedFromDiagrams,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listProjectPhotos,
  createProjectPhoto,
  streamProjectPhotoImage,
  deleteProjectPhoto,
  createProjectPhotosBulk,
  getProjectPhotoMeta,
  updateProjectPhotoAnnotations,
};
