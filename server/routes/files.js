// ============================================
// File Routes — /api/files
// ============================================

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");
const auth = require("../middleware/auth");
const logActivity = require("../middleware/logger");

const router = express.Router();

// ---- Multer config ----
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userDir = path.join(process.env.UPLOAD_DIR || "./uploads", String(req.user.id));
    fs.mkdirSync(userDir, { recursive: true });
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const storedName = uuidv4() + ext;
    cb(null, storedName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 52428800 }, // 50MB
});

// ---- GET /api/files — list all files for user ----
router.get("/", auth, async (req, res) => {
  try {
    const { folder_id, search, sort, category } = req.query;

    let query = `
      SELECT f.*, fo.name as folder_name 
      FROM files f 
      LEFT JOIN folders fo ON f.folder_id = fo.id 
      WHERE f.user_id = ?
    `;
    const params = [req.user.id];

    if (folder_id === "null" || folder_id === "root") {
      query += " AND f.folder_id IS NULL";
    } else if (folder_id) {
      query += " AND f.folder_id = ?";
      params.push(folder_id);
    }

    if (search) {
      query += " AND f.original_name LIKE ?";
      params.push(`%${search}%`);
    }

    if (category && category !== "all") {
      if (category === "image") query += " AND f.mime_type LIKE 'image/%'";
      else if (category === "video") query += " AND f.mime_type LIKE 'video/%'";
      else if (category === "audio") query += " AND f.mime_type LIKE 'audio/%'";
      else if (category === "document") query += " AND (f.mime_type LIKE '%pdf%' OR f.mime_type LIKE '%word%' OR f.mime_type LIKE '%document%' OR f.mime_type LIKE 'text/%')";
      else if (category === "starred") query += " AND f.is_starred = TRUE";
    }

    if (sort === "name") query += " ORDER BY f.original_name ASC";
    else if (sort === "size") query += " ORDER BY f.size DESC";
    else query += " ORDER BY f.created_at DESC";

    const [files] = await db.query(query, params);
    res.json({ files });
  } catch (err) {
    console.error("List files error:", err);
    res.status(500).json({ error: "Failed to fetch files." });
  }
});

// ---- POST /api/files/upload — upload files ----
router.post("/upload", auth, upload.array("files", 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files provided." });
    }

    const folderId = req.body.folder_id || null;
    const uploadedFiles = [];

    for (const file of req.files) {
      const [result] = await db.query(
        `INSERT INTO files (user_id, original_name, stored_name, mime_type, size, folder_id, upload_path)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user.id,
          file.originalname,
          file.filename,
          file.mimetype,
          file.size,
          folderId === "null" ? null : folderId,
          file.path,
        ]
      );

      uploadedFiles.push({
        id: result.insertId,
        original_name: file.originalname,
        size: file.size,
        mime_type: file.mimetype,
      });

      // Log
      await logActivity(
        req.user.id, "upload", "file", result.insertId, file.originalname,
        { size: file.size, mime_type: file.mimetype }, req.ip
      );
    }

    // Update storage used
    const totalSize = req.files.reduce((sum, f) => sum + f.size, 0);
    await db.query(
      "UPDATE users SET storage_used = storage_used + ? WHERE id = ?",
      [totalSize, req.user.id]
    );

    res.status(201).json({
      message: `${uploadedFiles.length} file(s) uploaded successfully.`,
      files: uploadedFiles,
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Upload failed." });
  }
});

// ---- Token-from-query middleware (for download/preview links) ----
function authFromQuery(req, res, next) {
  // Try header first, then query param
  const headerToken = req.headers.authorization?.split(" ")[1];
  const queryToken = req.query.token;
  const token = headerToken || queryToken;

  if (!token) {
    return res.status(401).json({ error: "No token provided." });
  }

  try {
    const jwt = require("jsonwebtoken");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.id, email: decoded.email, name: decoded.name };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}

// ---- Helper: get reliable file path from stored_name ----
function getFilePath(file) {
  // Try the stored upload_path first
  const uploadDir = path.resolve(process.env.UPLOAD_DIR || "./uploads");
  
  // Build path from user_id + stored_name (most reliable)
  const reliablePath = path.join(uploadDir, String(file.user_id), file.stored_name);
  if (fs.existsSync(reliablePath)) return reliablePath;

  // Fallback: try the stored upload_path as-is
  const storedPath = path.resolve(file.upload_path);
  if (fs.existsSync(storedPath)) return storedPath;

  // Fallback: try upload_path relative to server dir
  const serverRelative = path.resolve(__dirname, "..", file.upload_path);
  if (fs.existsSync(serverRelative)) return serverRelative;

  return null;
}

// ---- GET /api/files/:id/download — download a file ----
router.get("/:id/download", authFromQuery, async (req, res) => {
  try {
    const [files] = await db.query(
      "SELECT * FROM files WHERE id = ? AND user_id = ?",
      [req.params.id, req.user.id]
    );
    if (files.length === 0) {
      return res.status(404).json({ error: "File not found." });
    }

    const file = files[0];
    const filePath = getFilePath(file);

    if (!filePath) {
      console.error("File not found on disk. DB path:", file.upload_path, "stored_name:", file.stored_name);
      return res.status(404).json({ error: "File not found on disk." });
    }

    await logActivity(req.user.id, "download", "file", file.id, file.original_name, null, req.ip);

    res.download(filePath, file.original_name);
  } catch (err) {
    console.error("Download error:", err);
    res.status(500).json({ error: "Download failed." });
  }
});

// ---- GET /api/files/:id/view — view/preview a file inline ----
router.get("/:id/view", authFromQuery, async (req, res) => {
  try {
    const [files] = await db.query(
      "SELECT * FROM files WHERE id = ? AND user_id = ?",
      [req.params.id, req.user.id]
    );
    if (files.length === 0) {
      return res.status(404).json({ error: "File not found." });
    }

    const file = files[0];
    const filePath = getFilePath(file);

    if (!filePath) {
      console.error("File not found on disk. DB path:", file.upload_path, "stored_name:", file.stored_name);
      return res.status(404).json({ error: "File not found on disk." });
    }

    // Set content type and disposition to inline (view, not download)
    res.setHeader("Content-Type", file.mime_type || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(file.original_name)}"`);
    res.setHeader("Cache-Control", "private, max-age=3600");

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (err) {
    console.error("View error:", err);
    res.status(500).json({ error: "Failed to view file." });
  }
});

// ---- PATCH /api/files/:id/rename ----
router.patch("/:id/rename", auth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "New name is required." });

    const [files] = await db.query("SELECT * FROM files WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
    if (files.length === 0) return res.status(404).json({ error: "File not found." });

    const oldName = files[0].original_name;
    await db.query("UPDATE files SET original_name = ? WHERE id = ?", [name, req.params.id]);
    await logActivity(req.user.id, "rename", "file", files[0].id, name, { old_name: oldName }, req.ip);

    res.json({ message: "File renamed.", name });
  } catch (err) {
    console.error("Rename error:", err);
    res.status(500).json({ error: "Rename failed." });
  }
});

// ---- PATCH /api/files/:id/star ----
router.patch("/:id/star", auth, async (req, res) => {
  try {
    const [files] = await db.query("SELECT * FROM files WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
    if (files.length === 0) return res.status(404).json({ error: "File not found." });

    const newStatus = !files[0].is_starred;
    await db.query("UPDATE files SET is_starred = ? WHERE id = ?", [newStatus, req.params.id]);
    await logActivity(req.user.id, newStatus ? "star" : "unstar", "file", files[0].id, files[0].original_name, null, req.ip);

    res.json({ message: newStatus ? "File starred." : "File unstarred.", is_starred: newStatus });
  } catch (err) {
    console.error("Star error:", err);
    res.status(500).json({ error: "Failed to update star." });
  }
});

// ---- PATCH /api/files/:id/move ----
router.patch("/:id/move", auth, async (req, res) => {
  try {
    const { folder_id } = req.body;
    const [files] = await db.query("SELECT * FROM files WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
    if (files.length === 0) return res.status(404).json({ error: "File not found." });

    const newFolderId = folder_id === null || folder_id === "null" ? null : folder_id;
    await db.query("UPDATE files SET folder_id = ? WHERE id = ?", [newFolderId, req.params.id]);

    let folderName = "Root";
    if (newFolderId) {
      const [folders] = await db.query("SELECT name FROM folders WHERE id = ?", [newFolderId]);
      if (folders.length > 0) folderName = folders[0].name;
    }

    await logActivity(req.user.id, "move", "file", files[0].id, files[0].original_name, { to_folder: folderName }, req.ip);
    res.json({ message: `File moved to ${folderName}.` });
  } catch (err) {
    console.error("Move error:", err);
    res.status(500).json({ error: "Move failed." });
  }
});

// ---- DELETE /api/files — delete one or more files ----
router.delete("/", auth, async (req, res) => {
  try {
    const { ids } = req.body; // array of file IDs
    if (!ids || ids.length === 0) {
      return res.status(400).json({ error: "No file IDs provided." });
    }

    const placeholders = ids.map(() => "?").join(",");
    const [files] = await db.query(
      `SELECT * FROM files WHERE id IN (${placeholders}) AND user_id = ?`,
      [...ids, req.user.id]
    );

    if (files.length === 0) {
      return res.status(404).json({ error: "No matching files found." });
    }

    // Delete files from disk
    let freedSize = 0;
    for (const file of files) {
      const filePath = getFilePath(file);
      if (filePath) {
        fs.unlinkSync(filePath);
      }
      freedSize += file.size;
      await logActivity(req.user.id, "delete", "file", file.id, file.original_name, { size: file.size }, req.ip);
    }

    // Delete from DB
    await db.query(
      `DELETE FROM files WHERE id IN (${placeholders}) AND user_id = ?`,
      [...ids, req.user.id]
    );

    // Update storage used
    await db.query(
      "UPDATE users SET storage_used = GREATEST(0, storage_used - ?) WHERE id = ?",
      [freedSize, req.user.id]
    );

    res.json({ message: `${files.length} file(s) deleted.`, deleted: files.length });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ error: "Delete failed." });
  }
});

// ---- GET /api/files/stats — file count by category ----
router.get("/stats", auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN mime_type LIKE 'image/%' THEN 1 ELSE 0 END) as images,
        SUM(CASE WHEN mime_type LIKE 'video/%' THEN 1 ELSE 0 END) as videos,
        SUM(CASE WHEN mime_type LIKE 'audio/%' THEN 1 ELSE 0 END) as audio,
        SUM(CASE WHEN mime_type LIKE '%pdf%' OR mime_type LIKE '%word%' OR mime_type LIKE '%document%' OR mime_type LIKE 'text/%' THEN 1 ELSE 0 END) as documents,
        SUM(CASE WHEN is_starred = TRUE THEN 1 ELSE 0 END) as starred
       FROM files WHERE user_id = ?`,
      [req.user.id]
    );
    res.json({ stats: rows[0] });
  } catch (err) {
    console.error("Stats error:", err);
    res.status(500).json({ error: "Failed to fetch stats." });
  }
});

module.exports = router;
