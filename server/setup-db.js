// ============================================
// CloudVault — Database Setup Script
// Run: node setup-db.js
// ============================================

require("dotenv").config();
const mysql = require("mysql2/promise");

async function setupDatabase() {
  console.log("🚀 CloudVault Database Setup\n");

  // Step 1: Connect without database to create it
  console.log("1. Connecting to MySQL...");
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
  });
  console.log("   ✅ Connected to MySQL\n");

  // Step 2: Create database
  const dbName = process.env.DB_NAME || "cloudvault";
  console.log(`2. Creating database '${dbName}'...`);
  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await connection.query(`USE \`${dbName}\``);
  console.log("   ✅ Database created\n");

  // Step 3: Create Users table
  console.log("3. Creating 'users' table...");
  await connection.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      storage_used BIGINT DEFAULT 0,
      storage_limit BIGINT DEFAULT 5368709120,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_email (email)
    ) ENGINE=InnoDB
  `);
  console.log("   ✅ Users table created\n");

  // Step 4: Create Folders table
  console.log("4. Creating 'folders' table...");
  await connection.query(`
    CREATE TABLE IF NOT EXISTS folders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      parent_id INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE,
      UNIQUE KEY unique_folder (user_id, name, parent_id),
      INDEX idx_user_folder (user_id, parent_id)
    ) ENGINE=InnoDB
  `);
  console.log("   ✅ Folders table created\n");

  // Step 5: Create Files table
  console.log("5. Creating 'files' table...");
  await connection.query(`
    CREATE TABLE IF NOT EXISTS files (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      original_name VARCHAR(255) NOT NULL,
      stored_name VARCHAR(255) NOT NULL,
      mime_type VARCHAR(100) DEFAULT 'application/octet-stream',
      size BIGINT NOT NULL DEFAULT 0,
      folder_id INT DEFAULT NULL,
      is_starred BOOLEAN DEFAULT FALSE,
      upload_path VARCHAR(500) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL,
      INDEX idx_user_files (user_id),
      INDEX idx_user_folder_files (user_id, folder_id),
      FULLTEXT INDEX idx_filename (original_name)
    ) ENGINE=InnoDB
  `);
  console.log("   ✅ Files table created\n");

  // Step 6: Create User Preferences table
  console.log("6. Creating 'user_preferences' table...");
  await connection.query(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL UNIQUE,
      theme VARCHAR(20) DEFAULT 'dark',
      view_mode VARCHAR(10) DEFAULT 'grid',
      sort_by VARCHAR(20) DEFAULT 'date',
      default_folder_id INT DEFAULT NULL,
      notifications_enabled BOOLEAN DEFAULT TRUE,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `);
  console.log("   ✅ User preferences table created\n");

  // Step 7: Create Activity Logs table
  console.log("7. Creating 'activity_logs' table...");
  await connection.query(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      action VARCHAR(50) NOT NULL,
      entity_type VARCHAR(20) NOT NULL,
      entity_id INT DEFAULT NULL,
      entity_name VARCHAR(255) DEFAULT NULL,
      details JSON DEFAULT NULL,
      ip_address VARCHAR(45) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_user_activity (user_id, created_at),
      INDEX idx_action (action)
    ) ENGINE=InnoDB
  `);
  console.log("   ✅ Activity logs table created\n");

  // Done
  console.log("=" .repeat(45));
  console.log("✅ All tables created successfully!");
  console.log("=" .repeat(45));
  console.log("\nTables created:");
  console.log("  • users            — User accounts");
  console.log("  • folders          — User folders");
  console.log("  • files            — Uploaded file metadata");
  console.log("  • user_preferences — Theme, view mode, sort");
  console.log("  • activity_logs    — All user actions logged");
  console.log("\nYou can now start the server: npm start\n");

  await connection.end();
}

setupDatabase().catch((err) => {
  console.error("❌ Database setup failed:", err.message);
  console.error("\nMake sure:");
  console.error("  1. MySQL is running");
  console.error("  2. .env file has correct DB_USER and DB_PASSWORD");
  console.error("  3. The MySQL user has CREATE DATABASE privileges\n");
  process.exit(1);
});
