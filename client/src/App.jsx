import { useState, useEffect, useRef, useCallback } from "react";
import {
  apiRegister, apiLogin, apiGetMe,
  apiGetFiles, apiUploadFiles, apiDeleteFiles, apiRenameFile, apiStarFile, apiMoveFile, getDownloadUrl, getViewUrl, apiFetchFileBlob, apiGetFileStats,
  apiGetFolders, apiCreateFolder, apiDeleteFolder,
  apiGetPreferences, apiUpdatePreferences,
  apiGetActivity,
} from "./api";

// ---- Helpers ----
const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

const getFileIcon = (type) => {
  if (!type) return "📁";
  if (type.startsWith("image")) return "🖼️";
  if (type.startsWith("video")) return "🎬";
  if (type.startsWith("audio")) return "🎵";
  if (type.includes("pdf")) return "📄";
  if (type.includes("word") || type.includes("document")) return "📝";
  if (type.includes("sheet") || type.includes("excel")) return "📊";
  if (type.includes("zip") || type.includes("rar") || type.includes("tar")) return "📦";
  if (type.includes("javascript") || type.includes("python") || type.includes("html") || type.includes("json")) return "💻";
  return "📁";
};

const getActionIcon = (action) => {
  const map = { upload: "⬆️", download: "⬇️", delete: "🗑️", rename: "✏️", star: "⭐", unstar: "☆", move: "📂", login: "🔑", register: "👤", create: "➕", update: "⚙️" };
  return map[action] || "📋";
};

const timeAgo = (date) => {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return Math.floor(seconds / 60) + "m ago";
  if (seconds < 86400) return Math.floor(seconds / 3600) + "h ago";
  if (seconds < 604800) return Math.floor(seconds / 86400) + "d ago";
  return new Date(date).toLocaleDateString();
};

// ============ TOAST ============
function Toast({ message, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, background: type === "success" ? "#0d9488" : type === "error" ? "#dc2626" : "#2563eb", color: "#fff", padding: "14px 24px", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.25)", fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 500, display: "flex", alignItems: "center", gap: 10, animation: "slideUp 0.3s ease" }}>
      <span>{type === "success" ? "✓" : type === "error" ? "✕" : "ℹ"}</span>{message}
    </div>
  );
}

// ============ MODAL ============
function Modal({ title, children, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn 0.2s ease" }} onClick={onClose}>
      <div style={{ background: "#1e1e2e", borderRadius: 20, padding: 32, width: "90%", maxWidth: 440, boxShadow: "0 24px 80px rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.06)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h3 style={{ margin: 0, color: "#e2e8f0", fontFamily: "'Playfair Display',serif", fontSize: 22 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 20 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ============ LOGIN ============
function LoginPage({ onLogin, onSwitch }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) return setError("Please fill in all fields");
    setLoading(true); setError("");
    try {
      const data = await apiLogin(email, password);
      localStorage.setItem("cloudvault_token", data.token);
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  return (
    <div style={S.authContainer}>
      <style>{globalCSS}</style>
      <div style={S.authBg}><div style={S.authGlow1} /><div style={S.authGlow2} /></div>
      <div style={S.authCard}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 52, marginBottom: 8 }}>☁️</div>
          <h1 style={S.authTitle}>CloudVault</h1>
          <p style={S.authSubtitle}>Your files, everywhere you are</p>
        </div>
        {error && <div style={S.errorMsg}>{error}</div>}
        <div style={S.inputGroup}><label style={S.label}>Email</label><input style={S.input} type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSubmit()} /></div>
        <div style={S.inputGroup}><label style={S.label}>Password</label><input style={S.input} type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSubmit()} /></div>
        <button style={{ ...S.primaryBtn, opacity: loading ? 0.7 : 1 }} onClick={handleSubmit} disabled={loading}>{loading ? "Signing in..." : "Sign In"}</button>
        <p style={S.switchText}>Don't have an account? <span style={S.switchLink} onClick={onSwitch}>Create one</span></p>
      </div>
    </div>
  );
}

// ============ REGISTER ============
function RegisterPage({ onRegister, onSwitch }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name || !email || !password || !confirm) return setError("Please fill in all fields");
    if (password.length < 6) return setError("Password must be at least 6 characters");
    if (password !== confirm) return setError("Passwords do not match");
    setLoading(true); setError("");
    try {
      const data = await apiRegister(name, email, password);
      localStorage.setItem("cloudvault_token", data.token);
      onRegister(data.user);
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  return (
    <div style={S.authContainer}>
      <style>{globalCSS}</style>
      <div style={S.authBg}><div style={S.authGlow1} /><div style={S.authGlow2} /></div>
      <div style={S.authCard}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 52, marginBottom: 8 }}>☁️</div>
          <h1 style={S.authTitle}>Join CloudVault</h1>
          <p style={S.authSubtitle}>Start storing files securely in the cloud</p>
        </div>
        {error && <div style={S.errorMsg}>{error}</div>}
        <div style={S.inputGroup}><label style={S.label}>Full Name</label><input style={S.input} placeholder="Sanket More" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div style={S.inputGroup}><label style={S.label}>Email</label><input style={S.input} type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div style={S.inputGroup}><label style={S.label}>Password</label><input style={S.input} type="password" placeholder="Min 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <div style={S.inputGroup}><label style={S.label}>Confirm Password</label><input style={S.input} type="password" placeholder="••••••••" value={confirm} onChange={(e) => setConfirm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSubmit()} /></div>
        <button style={{ ...S.primaryBtn, opacity: loading ? 0.7 : 1 }} onClick={handleSubmit} disabled={loading}>{loading ? "Creating Account..." : "Create Account"}</button>
        <p style={S.switchText}>Already have an account? <span style={S.switchLink} onClick={onSwitch}>Sign in</span></p>
      </div>
    </div>
  );
}

// ============ DASHBOARD ============
function Dashboard({ user, onLogout }) {
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [stats, setStats] = useState({});
  const [activityLogs, setActivityLogs] = useState([]);
  const [userInfo, setUserInfo] = useState(user);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date");
  const [viewMode, setViewMode] = useState("grid");
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [toast, setToast] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [currentFolder, setCurrentFolder] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [contextMenu, setContextMenu] = useState(null);
  const [renameFile, setRenameFile] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef(null);

  const showToast = (message, type = "success") => setToast({ message, type });

  // ---- Load initial data ----
  useEffect(() => {
    async function loadData() {
      try {
        const [meData, filesData, foldersData, statsData, prefsData] = await Promise.all([
          apiGetMe(), apiGetFiles(), apiGetFolders(), apiGetFileStats(), apiGetPreferences()
        ]);
        setUserInfo(meData.user);
        setFiles(filesData.files);
        setFolders(foldersData.folders);
        setStats(statsData.stats);
        if (prefsData.preferences) {
          setViewMode(prefsData.preferences.view_mode || "grid");
          setSortBy(prefsData.preferences.sort_by || "date");
        }
      } catch (err) {
        if (err.message.includes("token") || err.message.includes("log in")) { onLogout(); }
        console.error("Load error:", err);
      } finally { setLoading(false); }
    }
    loadData();
  }, []);

  const refreshFiles = useCallback(async () => {
    try {
      const [filesData, statsData, meData] = await Promise.all([apiGetFiles(), apiGetFileStats(), apiGetMe()]);
      setFiles(filesData.files);
      setStats(statsData.stats);
      setUserInfo(meData.user);
    } catch (err) { console.error(err); }
  }, []);

  const refreshFolders = useCallback(async () => {
    try { const data = await apiGetFolders(); setFolders(data.folders); } catch (err) { console.error(err); }
  }, []);

  const updatePref = useCallback(async (key, value) => {
    try { await apiUpdatePreferences({ [key]: value }); } catch (err) { console.error(err); }
  }, []);

  // ---- File operations ----
  const handleUpload = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true); setUploadProgress(0);
    const interval = setInterval(() => setUploadProgress((p) => Math.min(p + Math.random() * 20 + 5, 90)), 200);
    try {
      await apiUploadFiles(fileList, currentFolder);
      clearInterval(interval); setUploadProgress(100);
      setTimeout(async () => {
        setUploading(false); setShowUploadModal(false); setUploadProgress(0);
        await refreshFiles(); await refreshFolders();
        showToast(fileList.length + " file(s) uploaded successfully");
      }, 400);
    } catch (err) {
      clearInterval(interval); setUploading(false); setUploadProgress(0);
      showToast(err.message, "error");
    }
  };

  const handleDelete = async (ids) => {
    try {
      await apiDeleteFiles(ids);
      setSelectedFiles(new Set());
      await refreshFiles(); await refreshFolders();
      showToast(ids.length + " file(s) deleted");
    } catch (err) { showToast(err.message, "error"); }
  };

  const handleDownload = async (file) => {
    try {
      showToast("Downloading " + file.original_name + "...", "info");
      const res = await fetch(`/api/files/${file.id}/download`, {
        headers: { Authorization: "Bearer " + localStorage.getItem("cloudvault_token") },
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.original_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      showToast("Download failed: " + err.message, "error");
    }
  };

  const handleRename = async (id, newName) => {
    try {
      await apiRenameFile(id, newName);
      setRenameFile(null);
      await refreshFiles();
      showToast("File renamed");
    } catch (err) { showToast(err.message, "error"); }
  };

  const handleStar = async (id) => {
    try { await apiStarFile(id); await refreshFiles(); } catch (err) { showToast(err.message, "error"); }
  };

  const handleMoveToFolder = async (id, folderId) => {
    try { await apiMoveFile(id, folderId); await refreshFiles(); await refreshFolders(); showToast("File moved"); } catch (err) { showToast(err.message, "error"); }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await apiCreateFolder(newFolderName.trim());
      setNewFolderName(""); setShowNewFolder(false);
      await refreshFolders();
      showToast("Folder created");
    } catch (err) { showToast(err.message, "error"); }
  };

  const handleViewModeChange = (mode) => { setViewMode(mode); updatePref("view_mode", mode); };
  const handleSortChange = (sort) => { setSortBy(sort); updatePref("sort_by", sort); };

  const loadActivity = async () => {
    try { const data = await apiGetActivity(30); setActivityLogs(data.logs); setShowActivity(true); } catch (err) { showToast(err.message, "error"); }
  };

  // ---- File preview helpers ----
  const isPreviewable = (mime) => {
    if (!mime) return false;
    return mime.startsWith("image/") || mime.startsWith("video/") || mime.startsWith("audio/") || mime === "application/pdf" || mime.startsWith("text/");
  };

  const openFile = async (file) => {
    if (isPreviewable(file.mime_type)) {
      setPreviewFile(file);
      setPreviewUrl(null);
      setPreviewLoading(true);
      try {
        const blobUrl = await apiFetchFileBlob(file.id);
        setPreviewUrl(blobUrl);
      } catch (err) {
        console.error("Preview error:", err);
        showToast("Preview failed: " + err.message, "error");
        setPreviewFile(null);
      } finally {
        setPreviewLoading(false);
      }
    } else {
      handleDownload(file);
    }
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewFile(null);
    setPreviewUrl(null);
  };

  // ---- Filter files ----
  let filteredFiles = files.filter((f) => {
    if (currentFolder !== null) {
      if (String(f.folder_id) !== String(currentFolder)) return false;
    } else {
      if (f.folder_id && activeFilter === "all") return false;
    }
    if (activeFilter === "starred") return f.is_starred;
    if (activeFilter === "image" && !f.mime_type?.startsWith("image")) return false;
    if (activeFilter === "video" && !f.mime_type?.startsWith("video")) return false;
    if (activeFilter === "audio" && !f.mime_type?.startsWith("audio")) return false;
    if (activeFilter === "document" && !(f.mime_type?.includes("pdf") || f.mime_type?.includes("word") || f.mime_type?.includes("document") || f.mime_type?.startsWith("text"))) return false;
    if (searchQuery && !f.original_name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  if (sortBy === "date") filteredFiles.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  else if (sortBy === "name") filteredFiles.sort((a, b) => a.original_name.localeCompare(b.original_name));
  else if (sortBy === "size") filteredFiles.sort((a, b) => b.size - a.size);

  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); };

  if (loading) {
    return (<div style={{ ...S.authContainer, flexDirection: "column", gap: 16 }}><style>{globalCSS}</style><div style={{ fontSize: 52 }}>☁️</div><p style={{ color: "#94a3b8", fontFamily: "'DM Sans',sans-serif" }}>Loading CloudVault...</p></div>);
  }

  return (
    <div style={S.dashboard} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onClick={() => { setContextMenu(null); setShowProfile(false); }}>
      <style>{globalCSS}</style>

      {dragOver && (<div style={S.dragOverlay}><div style={S.dragContent}><span style={{ fontSize: 56 }}>📂</span><p style={{ fontSize: 20, fontWeight: 600, color: "#e2e8f0" }}>Drop files to upload</p></div></div>)}

      {/* SIDEBAR */}
      <aside style={S.sidebar}>
        <div style={S.sidebarLogo}><span style={{ fontSize: 28 }}>☁️</span><span style={S.sidebarTitle}>CloudVault</span></div>
        <button style={S.uploadBtn} onClick={() => setShowUploadModal(true)}><span style={{ fontSize: 18 }}>+</span> Upload File</button>

        <nav style={S.nav}>
          <p style={S.navLabel}>Quick Access</p>
          {[
            { key: "all", icon: "📁", label: "All Files", count: stats.total || 0 },
            { key: "starred", icon: "⭐", label: "Starred", count: stats.starred || 0 },
            { key: "image", icon: "🖼️", label: "Images", count: stats.images || 0 },
            { key: "video", icon: "🎬", label: "Videos", count: stats.videos || 0 },
            { key: "document", icon: "📄", label: "Documents", count: stats.documents || 0 },
            { key: "audio", icon: "🎵", label: "Audio", count: stats.audio || 0 },
          ].map((item) => (
            <div key={item.key} style={{ ...S.navItem, background: activeFilter === item.key && !currentFolder ? "rgba(99,102,241,0.15)" : "transparent", color: activeFilter === item.key && !currentFolder ? "#818cf8" : "#94a3b8" }} onClick={() => { setActiveFilter(item.key); setCurrentFolder(null); }}>
              <span>{item.icon}</span><span style={{ flex: 1 }}>{item.label}</span><span style={S.badge}>{item.count}</span>
            </div>
          ))}
        </nav>

        <nav style={S.nav}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={S.navLabel}>Folders</p>
            <button style={S.addFolderBtn} onClick={() => setShowNewFolder(true)}>+</button>
          </div>
          {folders.map((folder) => (
            <div key={folder.id} style={{ ...S.navItem, color: currentFolder === folder.id ? "#818cf8" : "#94a3b8", background: currentFolder === folder.id ? "rgba(99,102,241,0.15)" : "transparent" }} onClick={() => { setCurrentFolder(folder.id); setActiveFilter("all"); }}>
              <span>📂</span><span style={{ flex: 1 }}>{folder.name}</span><span style={S.badge}>{folder.file_count || 0}</span>
            </div>
          ))}
        </nav>

        <div style={{ ...S.navItem, color: "#94a3b8", marginBottom: 12, cursor: "pointer" }} onClick={loadActivity}>
          <span>📋</span><span>Activity Log</span>
        </div>

        <div style={S.storageMeter}>
          <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>Storage Used</p>
          <div style={S.storageBar}><div style={{ ...S.storageBarFill, width: Math.min(((userInfo.storage_used || 0) / (userInfo.storage_limit || 5368709120)) * 100, 100) + "%" }} /></div>
          <p style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>{formatFileSize(userInfo.storage_used || 0)} of {formatFileSize(userInfo.storage_limit || 5368709120)}</p>
        </div>
      </aside>

      {/* MAIN */}
      <main style={S.main}>
        <header style={S.topBar}>
          <div style={S.searchBox}><span style={{ color: "#64748b" }}>🔍</span><input style={S.searchInput} placeholder="Search files..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
            <div style={S.viewToggle}>
              <button style={{ ...S.viewBtn, background: viewMode === "grid" ? "#334155" : "transparent" }} onClick={() => handleViewModeChange("grid")}>⊞</button>
              <button style={{ ...S.viewBtn, background: viewMode === "list" ? "#334155" : "transparent" }} onClick={() => handleViewModeChange("list")}>☰</button>
            </div>
            <div style={S.avatar} onClick={(e) => { e.stopPropagation(); setShowProfile(!showProfile); }}>{(userInfo.name || "U").charAt(0).toUpperCase()}</div>
            {showProfile && (
              <div style={S.profileDropdown} onClick={(e) => e.stopPropagation()}>
                <p style={{ fontWeight: 600, color: "#e2e8f0", fontSize: 14 }}>{userInfo.name}</p>
                <p style={{ color: "#64748b", fontSize: 12 }}>{userInfo.email}</p>
                <p style={{ color: "#475569", fontSize: 11, marginBottom: 12 }}>Joined {new Date(userInfo.created_at).toLocaleDateString()}</p>
                <button style={S.logoutBtn} onClick={() => { localStorage.removeItem("cloudvault_token"); onLogout(); }}>Sign Out</button>
              </div>
            )}
          </div>
        </header>

        <div style={S.actionBar}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {currentFolder && (<><span style={S.breadcrumb} onClick={() => setCurrentFolder(null)}>My Files</span><span style={{ color: "#475569" }}>/</span></>)}
            <h2 style={S.pageTitle}>{currentFolder ? folders.find((f) => f.id === currentFolder)?.name || "Folder" : activeFilter === "all" ? "My Files" : activeFilter === "starred" ? "Starred" : activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1) + "s"}</h2>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {selectedFiles.size > 0 && (<button style={S.deleteBtn} onClick={() => handleDelete([...selectedFiles])}>🗑 Delete ({selectedFiles.size})</button>)}
            <select style={S.sortSelect} value={sortBy} onChange={(e) => handleSortChange(e.target.value)}><option value="date">Recent</option><option value="name">Name</option><option value="size">Size</option></select>
          </div>
        </div>

        <div style={S.fileArea}>
          {filteredFiles.length === 0 ? (
            <div style={S.emptyState}>
              <span style={{ fontSize: 64 }}>📭</span>
              <p style={{ fontSize: 18, fontWeight: 600, color: "#cbd5e1", marginTop: 16 }}>No files here</p>
              <p style={{ color: "#64748b", marginTop: 4 }}>Upload files or drag & drop them here</p>
              <button style={{ ...S.primaryBtn, marginTop: 20, width: "auto", padding: "10px 28px" }} onClick={() => setShowUploadModal(true)}>Upload Files</button>
            </div>
          ) : viewMode === "grid" ? (
            <div style={S.fileGrid}>
              {filteredFiles.map((file) => (
                <div key={file.id} style={{ ...S.fileCard, border: selectedFiles.has(file.id) ? "1px solid #818cf8" : "1px solid rgba(255,255,255,0.04)" }}
                  onClick={() => openFile(file)}
                  onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, file }); }}>
                  <div style={S.fileCardTop}>
                    <span style={{ fontSize: 36 }}>{getFileIcon(file.mime_type)}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <input type="checkbox" checked={selectedFiles.has(file.id)} onChange={(e) => { e.stopPropagation(); const s = new Set(selectedFiles); s.has(file.id) ? s.delete(file.id) : s.add(file.id); setSelectedFiles(s); }} onClick={(e) => e.stopPropagation()} style={{ accentColor: "#818cf8", width: 16, height: 16, cursor: "pointer" }} />
                      <button style={S.starBtn} onClick={(e) => { e.stopPropagation(); handleStar(file.id); }}>{file.is_starred ? "⭐" : "☆"}</button>
                    </div>
                  </div>
                  <p style={S.fileName}>{file.original_name}</p>
                  <div style={S.fileMeta}><span>{formatFileSize(file.size)}</span><span>{new Date(file.created_at).toLocaleDateString()}</span></div>
                </div>
              ))}
            </div>
          ) : (
            <div>
              <div style={S.listHeader}><span style={{ flex: 2 }}>Name</span><span style={{ flex: 1 }}>Size</span><span style={{ flex: 1 }}>Date</span><span style={{ width: 80 }}>Actions</span></div>
              {filteredFiles.map((file) => (
                <div key={file.id} style={{ ...S.listRow, background: selectedFiles.has(file.id) ? "rgba(99,102,241,0.1)" : "transparent" }}
                  onClick={() => openFile(file)}
                  onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, file }); }}>
                  <span style={{ flex: 2, display: "flex", alignItems: "center", gap: 10 }}>
                    <input type="checkbox" checked={selectedFiles.has(file.id)} onChange={(e) => { e.stopPropagation(); const s = new Set(selectedFiles); s.has(file.id) ? s.delete(file.id) : s.add(file.id); setSelectedFiles(s); }} onClick={(e) => e.stopPropagation()} style={{ accentColor: "#818cf8", width: 16, height: 16, cursor: "pointer" }} />
                    <span>{getFileIcon(file.mime_type)}</span><span style={{ color: "#e2e8f0", fontSize: 14 }}>{file.original_name}</span>
                  </span>
                  <span style={{ flex: 1, color: "#64748b", fontSize: 13 }}>{formatFileSize(file.size)}</span>
                  <span style={{ flex: 1, color: "#64748b", fontSize: 13 }}>{new Date(file.created_at).toLocaleDateString()}</span>
                  <span style={{ width: 80, display: "flex", gap: 6 }}>
                    <button style={S.iconBtn} onClick={(e) => { e.stopPropagation(); handleDownload(file); }}>⬇</button>
                    <button style={S.iconBtn} onClick={(e) => { e.stopPropagation(); handleStar(file.id); }}>{file.is_starred ? "⭐" : "☆"}</button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Context Menu */}
      {contextMenu && (
        <div style={{ ...S.contextMenu, top: contextMenu.y, left: contextMenu.x }} onClick={(e) => e.stopPropagation()}>
          {[
            { label: "👁 Open / View", action: () => { openFile(contextMenu.file); setContextMenu(null); } },
            { label: "⬇ Download", action: () => { handleDownload(contextMenu.file); setContextMenu(null); } },
            { label: "✏️ Rename", action: () => { setRenameFile(contextMenu.file); setRenameValue(contextMenu.file.original_name); setContextMenu(null); } },
            { label: contextMenu.file.is_starred ? "☆ Unstar" : "⭐ Star", action: () => { handleStar(contextMenu.file.id); setContextMenu(null); } },
            ...folders.map((f) => ({ label: "📂 Move to " + f.name, action: () => { handleMoveToFolder(contextMenu.file.id, f.id); setContextMenu(null); } })),
            { label: "📂 Move to Root", action: () => { handleMoveToFolder(contextMenu.file.id, null); setContextMenu(null); } },
            { label: "🗑 Delete", action: () => { handleDelete([contextMenu.file.id]); setContextMenu(null); }, danger: true },
          ].map((item, i) => (
            <div key={i} style={{ ...S.contextMenuItem, color: item.danger ? "#ef4444" : "#e2e8f0" }} onClick={item.action}>{item.label}</div>
          ))}
        </div>
      )}

      {showUploadModal && (
        <Modal title="Upload Files" onClose={() => { setShowUploadModal(false); setUploading(false); setUploadProgress(0); }}>
          {uploading ? (
            <div style={{ textAlign: "center", padding: 20 }}>
              <div style={S.progressBar}><div style={{ ...S.progressFill, width: Math.min(uploadProgress, 100) + "%" }} /></div>
              <p style={{ color: "#94a3b8", fontSize: 14, marginTop: 12 }}>Uploading... {Math.min(Math.round(uploadProgress), 100)}%</p>
            </div>
          ) : (
            <div><div style={S.uploadZone} onClick={() => fileInputRef.current?.click()}><span style={{ fontSize: 48 }}>📤</span><p style={{ color: "#e2e8f0", fontWeight: 500, marginTop: 12 }}>Click to browse files</p><p style={{ color: "#64748b", fontSize: 13 }}>or drag and drop files anywhere</p></div><input ref={fileInputRef} type="file" multiple style={{ display: "none" }} onChange={(e) => handleUpload(e.target.files)} /></div>
          )}
        </Modal>
      )}

      {renameFile && (
        <Modal title="Rename File" onClose={() => setRenameFile(null)}>
          <input style={S.input} value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleRename(renameFile.id, renameValue)} autoFocus />
          <button style={{ ...S.primaryBtn, marginTop: 16 }} onClick={() => handleRename(renameFile.id, renameValue)}>Save</button>
        </Modal>
      )}

      {showNewFolder && (
        <Modal title="New Folder" onClose={() => setShowNewFolder(false)}>
          <input style={S.input} placeholder="Folder name" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()} autoFocus />
          <button style={{ ...S.primaryBtn, marginTop: 16 }} onClick={handleCreateFolder}>Create</button>
        </Modal>
      )}

      {showActivity && (
        <Modal title="Activity Log" onClose={() => setShowActivity(false)}>
          <div style={{ maxHeight: 400, overflowY: "auto" }}>
            {activityLogs.length === 0 ? (<p style={{ color: "#64748b", textAlign: "center", padding: 20 }}>No activity yet</p>) : activityLogs.map((log) => (
              <div key={log.id} style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", alignItems: "center" }}>
                <span style={{ fontSize: 18 }}>{getActionIcon(log.action)}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ color: "#e2e8f0", fontSize: 13 }}><strong style={{ textTransform: "capitalize" }}>{log.action}</strong>{log.entity_name ? " — " + log.entity_name : ""}</p>
                  <p style={{ color: "#475569", fontSize: 11 }}>{timeAgo(log.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* File Preview Modal */}
      {previewFile && (
        <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", display: "flex", flexDirection: "column", animation: "fadeIn 0.2s ease" }} onClick={closePreview}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.08)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 24 }}>{getFileIcon(previewFile.mime_type)}</span>
              <div>
                <p style={{ color: "#e2e8f0", fontSize: 15, fontWeight: 600 }}>{previewFile.original_name}</p>
                <p style={{ color: "#64748b", fontSize: 12 }}>{formatFileSize(previewFile.size)} — {new Date(previewFile.created_at).toLocaleDateString()}</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => handleDownload(previewFile)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#e2e8f0", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>⬇ Download</button>
              <button onClick={closePreview} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#94a3b8", fontSize: 16, cursor: "pointer", lineHeight: 1 }}>✕</button>
            </div>
          </div>
          {/* Preview Content */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            {previewLoading ? (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 48, animation: "pulse 1.5s infinite" }}>☁️</div>
                <p style={{ color: "#94a3b8", marginTop: 12 }}>Loading preview...</p>
              </div>
            ) : previewUrl ? (
              <>
                {previewFile.mime_type?.startsWith("image/") && (
                  <img src={previewUrl} alt={previewFile.original_name} style={{ maxWidth: "90%", maxHeight: "80vh", borderRadius: 12, boxShadow: "0 8px 40px rgba(0,0,0,0.5)", objectFit: "contain" }} />
                )}
                {previewFile.mime_type?.startsWith("video/") && (
                  <video controls autoPlay style={{ maxWidth: "90%", maxHeight: "80vh", borderRadius: 12, boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }}>
                    <source src={previewUrl} type={previewFile.mime_type} />
                    Your browser does not support video playback.
                  </video>
                )}
                {previewFile.mime_type?.startsWith("audio/") && (
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 80, marginBottom: 24 }}>🎵</div>
                    <p style={{ color: "#e2e8f0", fontSize: 18, fontWeight: 600, marginBottom: 20 }}>{previewFile.original_name}</p>
                    <audio controls autoPlay style={{ width: 400, maxWidth: "90vw" }}>
                      <source src={previewUrl} type={previewFile.mime_type} />
                    </audio>
                  </div>
                )}
                {previewFile.mime_type === "application/pdf" && (
                  <iframe src={previewUrl} title={previewFile.original_name} style={{ width: "90%", height: "85vh", border: "none", borderRadius: 12, background: "#fff" }} />
                )}
                {previewFile.mime_type?.startsWith("text/") && (
                  <iframe src={previewUrl} title={previewFile.original_name} style={{ width: "90%", height: "85vh", border: "none", borderRadius: 12, background: "#1e1e2e", color: "#e2e8f0" }} />
                )}
              </>
            ) : (
              <p style={{ color: "#ef4444" }}>Failed to load preview</p>
            )}
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

// ============ APP ============
export default function App() {
  const [page, setPage] = useState("login");
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("cloudvault_token");
    if (token) {
      apiGetMe().then((data) => { setUser(data.user); setPage("dashboard"); }).catch(() => { localStorage.removeItem("cloudvault_token"); });
    }
  }, []);

  const handleLogin = (u) => { setUser(u); setPage("dashboard"); };
  const handleLogout = () => { setUser(null); localStorage.removeItem("cloudvault_token"); setPage("login"); };

  if (page === "dashboard" && user) return <Dashboard user={user} onLogout={handleLogout} />;
  if (page === "register") return <RegisterPage onRegister={handleLogin} onSwitch={() => setPage("login")} />;
  return <LoginPage onLogin={handleLogin} onSwitch={() => setPage("register")} />;
}

// ============ GLOBAL CSS ============
const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0f0f1a; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }
  input:focus, button:focus { outline: none; }
`;

// ============ STYLES ============
const S = {
  authContainer: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans',sans-serif", background: "#0f0f1a", position: "relative", overflow: "hidden", padding: 20 },
  authBg: { position: "absolute", inset: 0, overflow: "hidden" },
  authGlow1: { position: "absolute", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)", top: -100, right: -100, animation: "pulse 6s infinite" },
  authGlow2: { position: "absolute", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(14,165,233,0.15) 0%, transparent 70%)", bottom: -50, left: -50, animation: "pulse 8s infinite" },
  authCard: { position: "relative", background: "rgba(30,30,46,0.85)", backdropFilter: "blur(20px)", borderRadius: 24, padding: 40, width: "100%", maxWidth: 420, border: "1px solid rgba(255,255,255,0.06)", boxShadow: "0 24px 80px rgba(0,0,0,0.4)" },
  authTitle: { fontFamily: "'Playfair Display',serif", fontSize: 28, fontWeight: 700, color: "#e2e8f0", marginBottom: 4 },
  authSubtitle: { color: "#64748b", fontSize: 14 },
  errorMsg: { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "10px 14px", color: "#fca5a5", fontSize: 13, marginBottom: 16 },
  inputGroup: { marginBottom: 18 },
  label: { display: "block", color: "#94a3b8", fontSize: 13, marginBottom: 6, fontWeight: 500 },
  input: { width: "100%", padding: "12px 16px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#e2e8f0", fontSize: 14, fontFamily: "'DM Sans',sans-serif" },
  primaryBtn: { width: "100%", padding: "13px 20px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #6366f1, #818cf8)", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", marginTop: 8 },
  switchText: { textAlign: "center", color: "#64748b", fontSize: 13, marginTop: 20 },
  switchLink: { color: "#818cf8", cursor: "pointer", fontWeight: 500 },
  dashboard: { display: "flex", minHeight: "100vh", fontFamily: "'DM Sans',sans-serif", background: "#0f0f1a", color: "#e2e8f0" },
  sidebar: { width: 260, background: "#161625", borderRight: "1px solid rgba(255,255,255,0.04)", padding: 20, display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh", overflowY: "auto" },
  sidebarLogo: { display: "flex", alignItems: "center", gap: 10, marginBottom: 28 },
  sidebarTitle: { fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 700, color: "#e2e8f0" },
  uploadBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 20px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #6366f1, #818cf8)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", marginBottom: 28 },
  nav: { marginBottom: 24 },
  navLabel: { fontSize: 11, color: "#475569", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
  navItem: { display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, cursor: "pointer", fontSize: 14, transition: "all 0.15s", marginBottom: 2 },
  badge: { fontSize: 11, color: "#64748b", background: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: 10 },
  addFolderBtn: { background: "none", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", width: 24, height: 24, borderRadius: 6, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" },
  storageMeter: { marginTop: "auto", padding: 16, background: "rgba(255,255,255,0.02)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.04)" },
  storageBar: { width: "100%", height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)" },
  storageBarFill: { height: "100%", borderRadius: 3, background: "linear-gradient(90deg, #6366f1, #818cf8)", transition: "width 0.3s" },
  main: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 },
  topBar: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 28px", borderBottom: "1px solid rgba(255,255,255,0.04)", position: "sticky", top: 0, background: "#0f0f1a", zIndex: 10 },
  searchBox: { display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "10px 16px", width: 360, border: "1px solid rgba(255,255,255,0.06)" },
  searchInput: { border: "none", background: "none", color: "#e2e8f0", fontSize: 14, width: "100%", fontFamily: "'DM Sans',sans-serif" },
  viewToggle: { display: "flex", background: "rgba(255,255,255,0.04)", borderRadius: 8, overflow: "hidden" },
  viewBtn: { border: "none", color: "#94a3b8", padding: "6px 10px", cursor: "pointer", fontSize: 14, background: "transparent" },
  avatar: { width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #818cf8)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, cursor: "pointer" },
  profileDropdown: { position: "absolute", top: 48, right: 0, background: "#1e1e2e", borderRadius: 14, padding: 16, boxShadow: "0 12px 40px rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.06)", zIndex: 100, minWidth: 200 },
  logoutBtn: { width: "100%", padding: "8px 0", borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", color: "#fca5a5", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" },
  actionBar: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 28px" },
  pageTitle: { fontFamily: "'Playfair Display',serif", fontSize: 24, fontWeight: 700, color: "#e2e8f0" },
  breadcrumb: { color: "#64748b", fontSize: 14, cursor: "pointer" },
  deleteBtn: { padding: "8px 16px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", color: "#fca5a5", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" },
  sortSelect: { padding: "8px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#94a3b8", fontSize: 13, fontFamily: "'DM Sans',sans-serif", cursor: "pointer" },
  fileArea: { flex: 1, padding: "0 28px 28px" },
  fileGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 },
  fileCard: { background: "rgba(255,255,255,0.02)", borderRadius: 16, padding: 20, cursor: "pointer", transition: "all 0.2s" },
  fileCardTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  starBtn: { background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: 4 },
  fileName: { color: "#e2e8f0", fontSize: 14, fontWeight: 500, marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  fileMeta: { display: "flex", justifyContent: "space-between", color: "#475569", fontSize: 12 },
  listHeader: { display: "flex", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", color: "#475569", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 },
  listRow: { display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.03)", cursor: "pointer", transition: "background 0.15s" },
  iconBtn: { background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 14, padding: 4 },
  emptyState: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 20px" },
  contextMenu: { position: "fixed", background: "#1e1e2e", borderRadius: 14, padding: 6, boxShadow: "0 12px 48px rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.06)", zIndex: 1000, minWidth: 180 },
  contextMenuItem: { padding: "9px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13, transition: "background 0.1s" },
  uploadZone: { border: "2px dashed rgba(99,102,241,0.3)", borderRadius: 16, padding: 48, textAlign: "center", cursor: "pointer" },
  progressBar: { width: "100%", height: 8, borderRadius: 4, background: "rgba(255,255,255,0.06)" },
  progressFill: { height: "100%", borderRadius: 4, background: "linear-gradient(90deg, #6366f1, #818cf8)", transition: "width 0.2s" },
  dragOverlay: { position: "fixed", inset: 0, zIndex: 9999, background: "rgba(15,15,26,0.9)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center" },
  dragContent: { textAlign: "center", border: "2px dashed #6366f1", borderRadius: 24, padding: "60px 80px" },
};
