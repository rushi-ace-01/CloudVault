// ============================================
// CloudVault Server — Entry Point
// ============================================

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 5000;

// ---- Middleware ----
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  process.env.CLIENT_URL, // Your Vercel URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.some((allowed) => origin.startsWith(allowed.replace(/\/$/, "")))) {
      return callback(null, true);
    }
    // In production, also allow any *.vercel.app subdomain
    if (origin.endsWith(".vercel.app")) {
      return callback(null, true);
    }
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---- Ensure upload directory exists ----
const uploadDir = process.env.UPLOAD_DIR || "./uploads";
fs.mkdirSync(uploadDir, { recursive: true });

// ---- API Routes ----
app.use("/api/auth", require("./routes/auth"));
app.use("/api/files", require("./routes/files"));
app.use("/api/folders", require("./routes/folders"));
app.use("/api/preferences", require("./routes/preferences"));
app.use("/api/activity", require("./routes/activity"));

// ---- Serve uploaded files with auth check ----
const jwt = require("jsonwebtoken");
app.get("/api/uploads/:userId/:fileName", (req, res) => {
  // Verify token from query string
  const token = req.query.token;
  if (!token) {
    return res.status(401).json({ error: "No token" });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Only allow users to access their own files
    if (String(decoded.id) !== String(req.params.userId)) {
      return res.status(403).json({ error: "Access denied" });
    }
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }

  const filePath = path.join(path.resolve(uploadDir), req.params.userId, req.params.fileName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }
  res.sendFile(filePath);
});

// ---- Health check ----
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Note: Frontend is deployed separately on Vercel.
// No static file serving needed here.

// ---- Error handler ----
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "File too large. Maximum size is 50MB." });
  }
  res.status(500).json({ error: "Internal server error." });
});

// ---- Start ----
app.listen(PORT, () => {
  console.log(`
  ☁️  CloudVault Server
  ────────────────────────────
  Port:     ${PORT}
  Mode:     ${process.env.NODE_ENV || "development"}
  Database: ${process.env.DB_NAME || "cloudvault"}
  Uploads:  ${path.resolve(uploadDir)}
  ────────────────────────────
  `);
});