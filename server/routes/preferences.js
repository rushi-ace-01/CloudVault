// ============================================
// Preferences Routes — /api/preferences
// ============================================

const express = require("express");
const db = require("../db");
const auth = require("../middleware/auth");
const logActivity = require("../middleware/logger");

const router = express.Router();

// ---- GET /api/preferences ----
router.get("/", auth, async (req, res) => {
  try {
    const [prefs] = await db.query(
      "SELECT * FROM user_preferences WHERE user_id = ?",
      [req.user.id]
    );

    if (prefs.length === 0) {
      // Create default preferences if none exist
      await db.query("INSERT INTO user_preferences (user_id) VALUES (?)", [req.user.id]);
      const [newPrefs] = await db.query("SELECT * FROM user_preferences WHERE user_id = ?", [req.user.id]);
      return res.json({ preferences: newPrefs[0] });
    }

    res.json({ preferences: prefs[0] });
  } catch (err) {
    console.error("Get preferences error:", err);
    res.status(500).json({ error: "Failed to fetch preferences." });
  }
});

// ---- PATCH /api/preferences ----
router.patch("/", auth, async (req, res) => {
  try {
    const { theme, view_mode, sort_by, default_folder_id, notifications_enabled } = req.body;

    const updates = [];
    const params = [];

    if (theme !== undefined) { updates.push("theme = ?"); params.push(theme); }
    if (view_mode !== undefined) { updates.push("view_mode = ?"); params.push(view_mode); }
    if (sort_by !== undefined) { updates.push("sort_by = ?"); params.push(sort_by); }
    if (default_folder_id !== undefined) { updates.push("default_folder_id = ?"); params.push(default_folder_id); }
    if (notifications_enabled !== undefined) { updates.push("notifications_enabled = ?"); params.push(notifications_enabled); }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No preferences to update." });
    }

    params.push(req.user.id);
    await db.query(
      `UPDATE user_preferences SET ${updates.join(", ")} WHERE user_id = ?`,
      params
    );

    await logActivity(req.user.id, "update", "preferences", null, null, req.body, req.ip);

    // Return updated preferences
    const [prefs] = await db.query("SELECT * FROM user_preferences WHERE user_id = ?", [req.user.id]);
    res.json({ message: "Preferences updated.", preferences: prefs[0] });
  } catch (err) {
    console.error("Update preferences error:", err);
    res.status(500).json({ error: "Failed to update preferences." });
  }
});

module.exports = router;
