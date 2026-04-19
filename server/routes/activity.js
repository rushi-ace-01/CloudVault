// ============================================
// Activity Log Routes — /api/activity
// ============================================

const express = require("express");
const db = require("../db");
const auth = require("../middleware/auth");

const router = express.Router();

// ---- GET /api/activity ----
router.get("/", auth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const [logs] = await db.query(
      `SELECT * FROM activity_logs 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [req.user.id, limit, offset]
    );

    const [countResult] = await db.query(
      "SELECT COUNT(*) as total FROM activity_logs WHERE user_id = ?",
      [req.user.id]
    );

    res.json({
      logs,
      total: countResult[0].total,
      limit,
      offset,
    });
  } catch (err) {
    console.error("Activity log error:", err);
    res.status(500).json({ error: "Failed to fetch activity logs." });
  }
});

module.exports = router;
