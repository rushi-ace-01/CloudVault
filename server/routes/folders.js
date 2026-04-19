// ============================================
// Folder Routes — /api/folders
// ============================================

const express = require("express");
const db = require("../db");
const auth = require("../middleware/auth");
const logActivity = require("../middleware/logger");

const router = express.Router();

// ---- GET /api/folders ----
router.get("/", auth, async (req, res) => {
  try {
    const [folders] = await db.query(
      "SELECT f.*, (SELECT COUNT(*) FROM files WHERE folder_id = f.id) as file_count FROM folders f WHERE f.user_id = ? ORDER BY f.name ASC",
      [req.user.id]
    );
    res.json({ folders });
  } catch (err) {
    console.error("List folders error:", err);
    res.status(500).json({ error: "Failed to fetch folders." });
  }
});

// ---- POST /api/folders ----
router.post("/", auth, async (req, res) => {
  try {
    const { name, parent_id } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Folder name is required." });
    }

    // Check duplicate
    const [existing] = await db.query(
      "SELECT id FROM folders WHERE user_id = ? AND name = ? AND parent_id <=> ?",
      [req.user.id, name.trim(), parent_id || null]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: "Folder already exists." });
    }

    const [result] = await db.query(
      "INSERT INTO folders (user_id, name, parent_id) VALUES (?, ?, ?)",
      [req.user.id, name.trim(), parent_id || null]
    );

    await logActivity(req.user.id, "create", "folder", result.insertId, name.trim(), null, req.ip);

    res.status(201).json({
      message: "Folder created.",
      folder: { id: result.insertId, name: name.trim(), file_count: 0 },
    });
  } catch (err) {
    console.error("Create folder error:", err);
    res.status(500).json({ error: "Failed to create folder." });
  }
});

// ---- DELETE /api/folders/:id ----
router.delete("/:id", auth, async (req, res) => {
  try {
    const [folders] = await db.query(
      "SELECT * FROM folders WHERE id = ? AND user_id = ?",
      [req.params.id, req.user.id]
    );
    if (folders.length === 0) {
      return res.status(404).json({ error: "Folder not found." });
    }

    // Move files to root before deleting folder
    await db.query(
      "UPDATE files SET folder_id = NULL WHERE folder_id = ? AND user_id = ?",
      [req.params.id, req.user.id]
    );

    await db.query("DELETE FROM folders WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
    await logActivity(req.user.id, "delete", "folder", folders[0].id, folders[0].name, null, req.ip);

    res.json({ message: "Folder deleted. Files moved to root." });
  } catch (err) {
    console.error("Delete folder error:", err);
    res.status(500).json({ error: "Failed to delete folder." });
  }
});

module.exports = router;
