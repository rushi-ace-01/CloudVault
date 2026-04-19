# ☁️ CloudVault — Full-Stack Cloud File Storage System

A complete cloud-based file storage system with **Node.js + Express** backend, **MySQL** database, and **React** frontend.

---

## 🚀 Deployment Guide (Frontend on Vercel + Backend on Render)

### Step 1: Push to GitHub

Push this entire `cloudvault-full/` folder as a GitHub repo.

```bash
cd cloudvault-full
git init
git add .
git commit -m "CloudVault full-stack app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/cloudvault.git
git push -u origin main
```

---

### Step 2: Deploy Backend on Render

1. Go to render.com and sign up / sign in
2. Click New then Web Service
3. Connect your GitHub repo
4. Configure:
   - Name: cloudvault-server
   - Root Directory: server
   - Runtime: Node
   - Build Command: npm install
   - Start Command: node index.js
5. Add Environment Variables (click Advanced):
   - NODE_ENV = production
   - DB_HOST = Your MySQL host
   - DB_PORT = 3306
   - DB_USER = Your MySQL username
   - DB_PASSWORD = Your MySQL password
   - DB_NAME = cloudvault
   - JWT_SECRET = Any long random string
   - CLIENT_URL = https://your-app.vercel.app (add after Step 3)
   - UPLOAD_DIR = ./uploads
   - MAX_FILE_SIZE = 52428800
6. Click Create Web Service
7. Wait for deploy and note your URL, e.g. https://cloudvault-server.onrender.com

Important: After creating the database on your MySQL host, run the setup script locally pointing at the remote DB: node setup-db.js

---

### Step 3: Deploy Frontend on Vercel

1. Go to vercel.com and sign in with GitHub
2. Click Add New Project and import your repo
3. Configure:
   - Root Directory: client
   - Framework Preset: Vite
   - Build Command: npm run build
   - Output Directory: dist
4. Add Environment Variable:
   - VITE_API_URL = https://cloudvault-server.onrender.com (your Render URL, no trailing slash)
5. Click Deploy
6. Note your URL, e.g. https://your-app.vercel.app

---

### Step 4: Connect Frontend to Backend

Go back to Render Dashboard, open your cloudvault-server, then Environment:
- Set CLIENT_URL to https://your-app.vercel.app
- Click Save Changes (server will auto-restart)

Done! Your app is live.

---

### Free MySQL Database Options

Since Render does not offer free MySQL, use one of these:

- PlanetScale — 1 DB, 1GB free — planetscale.com
- Clever Cloud — 256MB free — clever-cloud.com
- Aiven — 1GB free — aiven.io
- Railway — 1GB trial — railway.app

After creating the database, update your Render env vars with the host, user, password, and DB name.

---

## Local Development

```bash
cd server && npm install
cd ../client && npm install

# Edit server/.env with your MySQL password, then:
cd server && node setup-db.js

# Terminal 1
cd server && node index.js

# Terminal 2
cd client && npm run dev
```

Open http://localhost:5173

---

Built for MCA Project — School of Computational Sciences, SRTM University, Nanded.
