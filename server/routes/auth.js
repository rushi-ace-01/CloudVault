// ============================================
// Auth Routes — /api/auth
// ============================================

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const auth = require("../middleware/auth");
const logActivity = require("../middleware/logger");

const router = express.Router();

// ---- POST /api/auth/register ----
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required." });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }

    // Check duplicate email
    const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: "Email already registered." });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert user
    const [result] = await db.query(
      "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
      [name, email, hashedPassword]
    );
    const userId = result.insertId;

    // Create default preferences
    await db.query(
      "INSERT INTO user_preferences (user_id) VALUES (?)",
      [userId]
    );

    // Create default folders
    const defaultFolders = ["Documents", "Images", "Videos"];
    for (const folder of defaultFolders) {
      await db.query(
        "INSERT INTO folders (user_id, name) VALUES (?, ?)",
        [userId, folder]
      );
    }

    // Log activity
    const ip = req.ip || req.connection.remoteAddress;
    await logActivity(userId, "register", "user", userId, name, null, ip);

    // Generate token
    const token = jwt.sign(
      { id: userId, email, name },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "Account created successfully.",
      token,
      user: { id: userId, name, email },
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Server error. Please try again." });
  }
});

// ---- POST /api/auth/login ----
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    // Find user
    const [users] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    if (users.length === 0) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const user = users[0];

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // Log activity
    const ip = req.ip || req.connection.remoteAddress;
    await logActivity(user.id, "login", "session", null, null, null, ip);

    // Generate token
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful.",
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error. Please try again." });
  }
});

// ---- GET /api/auth/me ----
router.get("/me", auth, async (req, res) => {
  try {
    const [users] = await db.query(
      "SELECT id, name, email, storage_used, storage_limit, created_at FROM users WHERE id = ?",
      [req.user.id]
    );
    if (users.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }
    res.json({ user: users[0] });
  } catch (err) {
    console.error("Profile error:", err);
    res.status(500).json({ error: "Server error." });
  }
});

module.exports = router;
