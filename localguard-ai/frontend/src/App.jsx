import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  Shield, Github, FileCode, AlertTriangle,
  Lock, Printer, ArrowRight, Cpu, GitBranch, ScanLine, Copy, Check,
  Search, ChevronDown, ChevronRight, Folder, FolderOpen, Zap, Wand2, User, FileSearch, Info,
  Database, Network, Play, MoreHorizontal, ClipboardCheck, Layers, ShieldAlert, X
} from 'lucide-react';

// Read API_BASE dynamically from environment
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000/api";
const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID || "";

const FILE_ACCENTS = {
  py: '#eab308', js: '#facc15', ts: '#38bdf8', tsx: '#38bdf8', jsx: '#facc15',
  html: '#f97316', css: '#818cf8', cpp: '#818cf8', c: '#818cf8',
  java: '#ef4444', php: '#a78bfa', go: '#22d3ee', rb: '#f87171', rs: '#fb923c',
  json: '#94a3b8', md: '#94a3b8',
};
function getFileAccent(path) {
  const ext = (path.split('.').pop() || '').toLowerCase();
  return FILE_ACCENTS[ext] || '#64748b';
}

const FILE_GLYPHS = {
  py: 'py', js: 'JS', jsx: 'JS', ts: 'TS', tsx: 'TS', json: '{}',
  html: '<>', css: '#', go: 'go', java: 'J', php: 'php', rb: 'rb',
  rs: 'rs', c: 'C', cpp: 'C+', md: 'M', yml: 'Y', yaml: 'Y', sh: '$',
};
function getFileGlyph(path) {
  const ext = (path.split('.').pop() || '').toLowerCase();
  return FILE_GLYPHS[ext] || '•';
}

const LANG_NAMES = {
  py: 'Python', js: 'JavaScript', ts: 'TypeScript', tsx: 'TSX', jsx: 'JSX',
  html: 'HTML', css: 'CSS', java: 'Java', go: 'Go', php: 'PHP', c: 'C',
  cpp: 'C++', rb: 'Ruby', rs: 'Rust', json: 'JSON', md: 'Markdown',
};
function languageFromPath(path) {
  if (!path) return '';
  const ext = (path.split('.').pop() || '').toLowerCase();
  return LANG_NAMES[ext] || ext.toUpperCase();
}

function computeAvgRisk(findings) {
  if (!findings || findings.length === 0) return 0;
  const total = findings.reduce((sum, f) => sum + (parseFloat(f.cvss) || 7.0), 0);
  return total / findings.length;
}

function getRiskBand(score) {
  if (score >= 80) return { label: 'Critical Risk', cls: 'critical' };
  if (score >= 60) return { label: 'High Risk', cls: 'high' };
  if (score >= 35) return { label: 'Medium Risk', cls: 'medium' };
  return { label: 'Low Risk', cls: 'low' };
}

function timeAgo(dateStr) {
  if (!dateStr) return null;
  const diffMs = Date.now() - new Date(dateStr).getTime();
  if (Number.isNaN(diffMs)) return null;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatRepoSize(kb) {
  if (kb === undefined || kb === null || Number.isNaN(Number(kb))) return null;
  const n = Number(kb);
  if (n < 1024) return `${n} KB`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} MB`;
  return `${(n / (1024 * 1024)).toFixed(1)} GB`;
}

function buildFileTree(fileList) {
  const root = { name: '', type: 'dir', children: {} };
  (fileList || []).forEach(f => {
    const parts = f.path.split('/').filter(Boolean);
    let node = root;
    parts.forEach((part, i) => {
      const isLeaf = i === parts.length - 1;
      if (isLeaf) {
        node.children[part] = { name: part, type: 'file', path: f.path };
      } else {
        if (!node.children[part] || node.children[part].type !== 'dir') {
          node.children[part] = { name: part, type: 'dir', children: {} };
        }
        node = node.children[part];
      }
    });
  });
  return root;
}

const CODE_KEYWORDS = new Set([
  'import', 'from', 'as', 'class', 'def', 'return', 'if', 'else', 'elif', 'for', 'while',
  'try', 'except', 'finally', 'raise', 'with', 'in', 'not', 'and', 'or', 'is', 'pass',
  'lambda', 'yield', 'global', 'None', 'True', 'False', 'self', 'async', 'await',
  'const', 'let', 'var', 'function', 'new', 'export', 'default', 'extends', 'implements',
  'interface', 'type', 'enum', 'public', 'private', 'protected', 'static', 'void',
  'package', 'func', 'struct', 'this', 'null', 'undefined', 'true', 'false', 'throw',
  'switch', 'case', 'break', 'continue', 'delete', 'typeof', 'instanceof',
]);

const TOKEN_RE =
  /(\s+)|(#[^\n]*|\/\/[^\n]*)|("(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?|`(?:[^`\\]|\\.)*`?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|([^\sA-Za-z0-9_$])/g;

function tokenizeLine(line) {
  const out = [];
  TOKEN_RE.lastIndex = 0;
  let m;
  while ((m = TOKEN_RE.exec(line)) !== null) {
    if (m[1]) out.push({ t: m[1], cls: '' });
    else if (m[2]) out.push({ t: m[2], cls: 'tok-com' });
    else if (m[3]) out.push({ t: m[3], cls: 'tok-str' });
    else if (m[4]) out.push({ t: m[4], cls: 'tok-num' });
    else if (m[5]) {
      const word = m[5];
      const next = line[TOKEN_RE.lastIndex];
      if (CODE_KEYWORDS.has(word)) out.push({ t: word, cls: 'tok-kw' });
      else if (next === '(') out.push({ t: word, cls: 'tok-fn' });
      else if (/^[A-Z]/.test(word)) out.push({ t: word, cls: 'tok-type' });
      else out.push({ t: word, cls: 'tok-id' });
    } else out.push({ t: m[6], cls: 'tok-op' });
    if (m.index === TOKEN_RE.lastIndex) TOKEN_RE.lastIndex++;
  }
  return out;
}

function findingLineNumber(f) {
  if (!f) return null;
  const raw = f.line ?? f.line_number ?? f.lineno ?? f.start_line;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function findingId(f, idx) {
  return f?.id || f?.finding_id || `ZDB-${2000 + idx}`;
}

function ZeroDayLogo({ size = 26 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="zdb-logo-svg"
    >
      <defs>
        <linearGradient id="zdb-logo-grad" x1="4" y1="2" x2="36" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#818cf8" />
        </linearGradient>
        <radialGradient id="zdb-logo-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f0f9ff" stopOpacity="1" />
          <stop offset="60%" stopColor="#7dd3fc" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d="M20 2 L35 8 V19 C35 28.5 28.8 35.6 20 38 C11.2 35.6 5 28.5 5 19 V8 Z" fill="url(#zdb-logo-grad)" opacity="0.16" />
      <path d="M20 2 L35 8 V19 C35 28.5 28.8 35.6 20 38 C11.2 35.6 5 28.5 5 19 V8 Z" stroke="url(#zdb-logo-grad)" strokeWidth="1.7" strokeLinejoin="round" fill="none" />
      <path d="M20 8.5 V15.5 M11.5 14 L16.4 17.2 M28.5 14 L23.6 17.2 M14.5 27 L17.8 21.8 M25.5 27 L22.2 21.8" stroke="url(#zdb-logo-grad)" strokeWidth="1.15" strokeLinecap="round" opacity="0.85" />
      <circle cx="11.5" cy="14" r="1.25" fill="#38bdf8" />
      <circle cx="28.5" cy="14" r="1.25" fill="#818cf8" />
      <circle cx="14.5" cy="27" r="1.25" fill="#818cf8" />
      <circle cx="25.5" cy="27" r="1.25" fill="#38bdf8" />
      <circle cx="20" cy="8.5" r="1.25" fill="#7dd3fc" />
      <circle cx="20" cy="19.2" r="6.4" fill="url(#zdb-logo-core)" opacity="0.55" />
      <circle cx="20" cy="19.2" r="3.4" stroke="#bae6fd" strokeWidth="1.1" fill="none" opacity="0.8" />
      <circle cx="20" cy="19.2" r="1.7" fill="#f0f9ff" />
    </svg>
  );
}

const SEVERITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const LARGE_REPO_THRESHOLD = 15;

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("gh_token") || "");
  const [showLanding, setShowLanding] = useState(!localStorage.getItem("gh_token"));
  const [repos, setRepos] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState("");
  const [codeContent, setCodeContent] = useState("");
  const [repoResults, setRepoResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedFindingIdx, setCopiedFindingIdx] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDirs, setExpandedDirs] = useState(() => new Set());
  const [expandedFindingIdx, setExpandedFindingIdx] = useState(0);

  const [mobilePane, setMobilePane] = useState('explorer');

  const authAttempted = React.useRef(false);
  const searchInputRef = React.useRef(null);

  // Helper for Authorization Headers
  const getAuthHeader = () => ({
    headers: { Authorization: `Bearer ${token}` }
  });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code && !token && !authAttempted.current) {
      authAttempted.current = true;
      window.history.replaceState({}, document.title, window.location.pathname);

      axios.post(`${API_BASE}/auth/github`, { code })
        .then(res => {
          if (res.data.token) {
            setToken(res.data.token);
            localStorage.setItem("gh_token", res.data.token);
            setShowLanding(false);
          }
        })
        .catch(err => {
          console.error("OAuth error:", err);
          authAttempted.current = false;
        });
    }
  }, []);

  useEffect(() => {
    if (token) {
      axios.get(`${API_BASE}/github/repos`, getAuthHeader())
        .then(res => {
          const repoData = Array.isArray(res.data) ? res.data : (res.data.items || []);
          setRepos(repoData);
          setShowLanding(false);
        })
        .catch(err => {
          console.error("Repo fetch error:", err);
          if (err.response?.status === 401) {
            localStorage.removeItem("gh_token");
            setToken("");
            setShowLanding(true);
          }
        });
    }
  }, [token]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setMobilePane('explorer');
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleSelectRepo = (repo) => {
    setSelectedRepo(repo);
    setRepoResults(null);
    setCodeContent("");
    setSelectedFile("");
    const owner = repo.owner?.login || repo.owner;
    axios.get(`${API_BASE}/github/tree?owner=${owner}&repo=${repo.name}`, getAuthHeader())
      .then(res => setFiles(res.data.files || []))
      .catch(err => console.error("Tree fetch error:", err));
  };

  const handleSelectFile = (filePath) => {
    setSelectedFile(filePath);
    const owner = selectedRepo.owner?.login || selectedRepo.owner;
    axios.get(`${API_BASE}/github/file?owner=${owner}&repo=${selectedRepo.name}&path=${filePath}`, getAuthHeader())
      .then(res => setCodeContent(res.data.content || ""))
      .catch(err => console.error("File content error:", err));
  };

  const handleRunSingleFileAudit = () => {
    if (!selectedRepo || !selectedFile) return;
    setLoading(true);
    setLoadingText(`Auditing file (${selectedFile})...`);
    setRepoResults(null);

    const owner = selectedRepo.owner?.login || selectedRepo.owner;
    axios.post(`${API_BASE}/audit-file`, {
      owner: owner,
      repo: selectedRepo.name,
      path: selectedFile
    }, getAuthHeader())
      .then(res => {
        setRepoResults(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Single file audit error:", err);
        setLoading(false);
      });
  };

  const handleRunFullRepoAudit = () => {
    if (!selectedRepo) return;
    setLoading(true);
    setLoadingText("Scanning full repository files via GPU...");
    setRepoResults(null);

    const owner = selectedRepo.owner?.login || selectedRepo.owner;
    axios.post(`${API_BASE}/audit-repo`, {
      owner: owner,
      repo: selectedRepo.name
    }, { ...getAuthHeader(), timeout: 600000 })
      .then(res => {
        setRepoResults(res.data || {});
        setLoading(false);
      })
      .catch(err => {
        console.error("Audit error:", err);
        setLoading(false);
        alert("Scan timed out or failed. Check backend configuration.");
      });
  };

  const handlePrintReport = () => {
    window.print();
  };

  const loginWithGithub = () => {
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&scope=repo`;
  };

  const getSeverityClass = (sev) => {
    switch (sev) {
      case 'CRITICAL': return 'critical';
      case 'HIGH': return 'high';
      case 'MEDIUM': return 'medium';
      default: return 'low';
    }
  };

  const handleCopyCode = () => {
    if (!codeContent) return;
    navigator.clipboard?.writeText(codeContent).then(() => {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1500);
    });
  };

  const handleCopyFix = (fixText, idx) => {
    if (!fixText) return;
    navigator.clipboard?.writeText(fixText).then(() => {
      setCopiedFindingIdx(idx);
      setTimeout(() => setCopiedFindingIdx(null), 1500);
    });
  };

  const toggleDir = (dirPath) => {
    setExpandedDirs(prev => {
      const next = new Set(prev);
      if (next.has(dirPath)) next.delete(dirPath);
      else next.add(dirPath);
      return next;
    });
  };

  const isLargeRepo = files.length > LARGE_REPO_THRESHOLD;
  const codeLines = codeContent ? codeContent.split('\n') : [];
  const avgRisk = computeAvgRisk(repoResults?.findings);
  const riskScore = Math.max(0, Math.min(100, avgRisk * 10));
  const riskBand = getRiskBand(riskScore);
  const gaugeCircumference = Math.PI * 50;

  const ownerLogin = selectedRepo ? (selectedRepo.owner?.login || selectedRepo.owner) : '';
  const branchName = selectedRepo?.default_branch || 'main';
  const repoSize = formatRepoSize(selectedRepo?.size);
  const syncedAgo = timeAgo(selectedRepo?.pushed_at || selectedRepo?.updated_at);

  const visibleFiles = useMemo(() => {
    if (!searchQuery.trim()) return files;
    const q = searchQuery.toLowerCase();
    return files.filter(f => f.path.toLowerCase().includes(q));
  }, [files, searchQuery]);

  const fileTree = useMemo(() => buildFileTree(visibleFiles), [visibleFiles]);

  const findingCountByFile = useMemo(() => {
    const map = {};
    (repoResults?.findings || []).forEach(f => {
      if (f?.file_path) map[f.file_path] = (map[f.file_path] || 0) + 1;
    });
    return map;
  }, [repoResults]);

  const currentFileFindings = useMemo(() => {
    if (!repoResults?.findings || !selectedFile) return [];
    return repoResults.findings.filter(f => f && f.file_path === selectedFile);
  }, [repoResults, selectedFile]);

  const lineFindingMap = useMemo(() => {
    const map = {};
    currentFileFindings.forEach(f => {
      const ln = findingLineNumber(f);
      if (ln && !map[ln]) map[ln] = f;
    });
    return map;
  }, [currentFileFindings]);

  const topFileFinding = useMemo(() => {
    if (currentFileFindings.length === 0) return null;
    return [...currentFileFindings]
      .sort((a, b) => (parseFloat(b.cvss) || 0) - (parseFloat(a.cvss) || 0))[0];
  }, [currentFileFindings]);

  const sortedFindings = useMemo(() => {
    if (!repoResults || !Array.isArray(repoResults.findings)) return [];
    return [...repoResults.findings]
      .filter(f => f && typeof f === 'object')
      .sort((a, b) => (parseFloat(b.cvss) || 0) - (parseFloat(a.cvss) || 0));
  }, [repoResults]);

  const severityCounts = useMemo(() => {
    const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    if (repoResults && Array.isArray(repoResults.findings)) {
      repoResults.findings.forEach(f => {
        if (!f) return;
        const key = (f.severity && SEVERITY_ORDER.includes(f.severity.toUpperCase()))
          ? f.severity.toUpperCase()
          : 'LOW';
        counts[key] = (counts[key] || 0) + 1;
      });
    }
    return counts;
  }, [repoResults]);

  const breadcrumbParts = selectedFile ? selectedFile.split('/').filter(Boolean) : [];

  const openFileFromFinding = (path) => {
    if (!path) return;
    handleSelectFile(path);
    setMobilePane('code');
  };

  const renderTree = (node, path, depth) => {
    const entries = Object.values(node.children).sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return entries.map(entry => {
      if (entry.type === 'dir') {
        const dirPath = path ? `${path}/${entry.name}` : entry.name;
        const isOpen = searchQuery.trim() ? true : expandedDirs.has(dirPath);
        return (
          <div key={dirPath}>
            <div
              className="zdb-tree-row zdb-tree-dir"
              style={{ paddingLeft: 10 + depth * 14 }}
              onClick={() => toggleDir(dirPath)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') toggleDir(dirPath); }}
            >
              {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              {isOpen ? <FolderOpen size={13} /> : <Folder size={13} />}
              <span>{entry.name}</span>
            </div>
            {isOpen && renderTree(entry, dirPath, depth + 1)}
          </div>
        );
      }
      const count = findingCountByFile[entry.path];
      const accent = getFileAccent(entry.path);
      return (
        <div
          key={entry.path}
          onClick={() => { handleSelectFile(entry.path); setMobilePane('code'); }}
          className={`zdb-tree-row zdb-tree-file ${selectedFile === entry.path ? 'active' : ''}`}
          style={{ paddingLeft: 10 + depth * 14 + 16 }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') { handleSelectFile(entry.path); setMobilePane('code'); } }}
          title={entry.path}
        >
          <span className="zdb-file-glyph" style={{ color: accent, borderColor: `${accent}44` }}>
            {getFileGlyph(entry.path)}
          </span>
          <span className="zdb-file-name">{entry.name}</span>
          {count > 0 && <span className="zdb-file-badge">{count}</span>}
        </div>
      );
    });
  };

  return (
    <div className="app-shell">
      {showLanding && !token ? (
        <div className="landing">
          <div className="landing-inner">
            <div className="landing-copy">
              <div className="brand-mark">
                <Shield color="var(--accent)" size={30} />
                <span>ZERO DAY BUSTER</span>
              </div>
              <h1 className="hero-headline">
                Autonomous <em>Zero-Day</em> &amp; AST Vulnerability Engine
              </h1>
              <p className="hero-sub">
                Point it at a repository and it reads the code the way an attacker would.
              </p>
              <button onClick={loginWithGithub} className="cta-button">
                <Github size={19} /> Connect GitHub Workspace <ArrowRight size={17} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="command-deck">
          <header className="no-print zdb-topbar">
            <div className="zdb-topbar-left">
              <span className="zdb-logo-chip"><ZeroDayLogo size={22} /></span>
              <span className="zdb-topbar-title">Zero Day Buster</span>
              <span className="zdb-version-badge">v2.4.0-enterprise</span>
            </div>

            <div className="zdb-topbar-center">
              <div className="zdb-repo-switcher">
                <Layers size={13} />
                <span className="zdb-repo-switcher-name">
                  {selectedRepo ? `${ownerLogin}/${selectedRepo.name}` : 'No repository selected'}
                </span>
                {selectedRepo && <span className="zdb-branch-tag">/ {branchName}</span>}
                <ChevronDown size={13} className="dim" />
              </div>
            </div>

            <div className="zdb-topbar-right">
              <div className="zdb-search">
                <Search size={13} />
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Quick Search"
                  aria-label="Quick search files"
                />
                <kbd>⌘K</kbd>
              </div>

              <button
                onClick={handlePrintReport}
                className="zdb-export-btn"
                disabled={!repoResults}
                title={repoResults ? 'Export executive PDF report' : 'Run a scan to enable the report'}
              >
                <Printer size={13} /> <span className="zdb-btn-label">Export Executive PDF</span>
              </button>

              <div className="status-pill zdb-hide-md">
                <span className="status-ring" /> Neural Engine Active
              </div>

              <button className="zdb-avatar-btn" title="Account">
                <User size={15} />
              </button>
            </div>
          </header>

          <nav className="no-print zdb-mobile-tabs" aria-label="Workspace panes">
            <button
              className={`zdb-mobile-tab ${mobilePane === 'explorer' ? 'active' : ''}`}
              onClick={() => setMobilePane('explorer')}
            >
              <Folder size={14} /> Explorer
            </button>
            <button
              className={`zdb-mobile-tab ${mobilePane === 'code' ? 'active' : ''}`}
              onClick={() => setMobilePane('code')}
            >
              <FileCode size={14} /> Code
            </button>
            <button
              className={`zdb-mobile-tab ${mobilePane === 'threats' ? 'active' : ''}`}
              onClick={() => setMobilePane('threats')}
            >
              <ShieldAlert size={14} /> Threats
              {sortedFindings.length > 0 && <span className="zdb-tab-count">{sortedFindings.length}</span>}
            </button>
          </nav>

          <div className={`command-body pane-${mobilePane}`}>
            <aside className="no-print panel zdb-left-panel" data-pane="explorer">
              <div className="zdb-panel-caption">
                <span>Repository</span>
                <button className="zdb-icon-btn zdb-icon-btn-sm" title="Repository actions">
                  <MoreHorizontal size={14} />
                </button>
              </div>

              {selectedRepo ? (
                <>
                  <div className="zdb-repo-overview">
                    <div className="zdb-repo-overview-top">
                      <div className="zdb-repo-overview-name">
                        <Github size={14} />
                        <span>{ownerLogin}/{selectedRepo.name}</span>
                      </div>
                      <span className="zdb-health-badge">
                        <span className="dot" /> Healthy
                      </span>
                    </div>

                    <div className="zdb-repo-overview-meta">
                      Synced {syncedAgo || 'just now'}
                    </div>

                    <div className="zdb-repo-overview-stats">
                      <span><GitBranch size={12} /> {branchName}</span>
                      <span><b>{files.length.toLocaleString()}</b> files</span>
                      {repoSize && <span><b>{repoSize}</b></span>}
                    </div>

                    <button
                      onClick={() => { setSelectedRepo(null); setFiles([]); setSelectedFile(''); setCodeContent(''); setRepoResults(null); }}
                      className="zdb-switch-repo-btn"
                    >
                      <ChevronRight size={11} /> Switch repository
                    </button>
                  </div>

                  {isLargeRepo && (
                    <div className="zdb-large-warn">
                      <div className="zdb-large-warn-head">
                        <Info size={13} /> Large Repository ({files.length} files)
                      </div>
                      A full scan will take longer. Consider selecting a file to scan individually.
                    </div>
                  )}

                  {selectedFile && (
                    <button
                      onClick={handleRunSingleFileAudit}
                      disabled={loading}
                      className="zdb-file-scan-btn"
                    >
                      <FileSearch size={14} /> Scan Selected File
                    </button>
                  )}

                  <button
                    onClick={() => { handleRunFullRepoAudit(); setMobilePane('threats'); }}
                    disabled={loading}
                    className="zdb-scan-cta"
                  >
                    <span className="zdb-scan-cta-main">
                      {loading ? <span className="zdb-spinner-sm" /> : <Zap size={15} />}
                      {loading ? 'Scanning…' : 'Scan Repository'}
                    </span>
                    <span className="zdb-scan-cta-kbd">⌘⏎</span>
                  </button>

                  <div className="zdb-explorer">
                    <div className="zdb-explorer-head">
                      <span>Explorer</span>
                      <span className="explorer-count">{visibleFiles.length}</span>
                    </div>
                    <div className="zdb-tree">
                      {visibleFiles.length > 0
                        ? renderTree(fileTree, '', 0)
                        : <div className="zdb-tree-empty">No files match “{searchQuery}”</div>}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="zdb-explorer-head">
                    <span>Repositories</span>
                    <span className="explorer-count">{repos.length}</span>
                  </div>
                  {repos.length === 0 && (
                    <div className="empty-state">Loading repositories from<br /><strong>your GitHub workspace…</strong></div>
                  )}
                  {repos.map((r, idx) => (
                    <div
                      key={r.id || idx}
                      onClick={() => handleSelectRepo(r)}
                      className="repo-card"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSelectRepo(r); }}
                    >
                      <Github size={13} /> <span className="zdb-file-name">{r.name}</span>
                      <ChevronRight size={13} className="dim" />
                    </div>
                  ))}
                </>
              )}

              <div className="zdb-explorer-footer">
                <div className="zdb-footer-metric">
                  <span><Network size={12} /> AST graph indexed</span>
                  <span className="ok">100%</span>
                </div>
                <div className="zdb-footer-metric">
                  <span><Database size={12} /> Dependency DB</span>
                  <span>Updated</span>
                </div>
              </div>
            </aside>

            <section className="no-print panel zdb-editor-panel" data-pane="code">
              <div className="zdb-editor-header">
                <div className="inspector-dots">
                  <span className="dot" /><span className="dot" /><span className="dot" />
                </div>

                <div className="zdb-breadcrumbs">
                  {breadcrumbParts.length === 0 && <span>No file open</span>}
                  {breadcrumbParts.map((part, i) => {
                    const isLast = i === breadcrumbParts.length - 1;
                    return (
                      <React.Fragment key={`${part}-${i}`}>
                        {i > 0 && <ChevronRight size={12} />}
                        {isLast
                          ? (
                            <span className="current">
                              <span className="zdb-file-glyph" style={{ color: getFileAccent(selectedFile), borderColor: `${getFileAccent(selectedFile)}44` }}>
                                {getFileGlyph(selectedFile)}
                              </span>
                              {part}
                            </span>
                          )
                          : <span>{part}</span>}
                      </React.Fragment>
                    );
                  })}
                </div>

                <div className="inspector-meta">
                  {codeContent && <span className="zdb-meta-pill">{codeLines.length} lines</span>}
                  {selectedFile && <span className="zdb-meta-pill">{languageFromPath(selectedFile)}</span>}
                  <button
                    onClick={handleCopyCode}
                    className={`copy-btn ${copiedCode ? 'copied' : ''}`}
                    disabled={!codeContent}
                  >
                    {copiedCode ? <Check size={12} /> : <Copy size={12} />}
                    <span className="zdb-btn-label">{copiedCode ? 'Copied' : 'Copy Snippet'}</span>
                  </button>
                </div>
              </div>

              {codeContent ? (
                <div className="zdb-editor-body-wrap">
                  <div className="zdb-code-scroll">
                    {codeLines.map((line, i) => {
                      const lineNo = i + 1;
                      const hit = lineFindingMap[lineNo];
                      const sev = hit ? getSeverityClass((hit.severity || '').toUpperCase()) : '';
                      return (
                        <React.Fragment key={i}>
                          <div className={`zdb-code-row ${hit ? `flagged ${sev}` : ''}`}>
                            <span className="zdb-ln">{lineNo}</span>
                            <code className="zdb-code-line">
                              {tokenizeLine(line).map((tk, ti) => (
                                <span key={ti} className={tk.cls}>{tk.t}</span>
                              ))}
                              {line.length === 0 ? '\u200b' : ''}
                            </code>
                          </div>
                          {hit && (
                            <div className={`zdb-inline-alert ${sev}`}>
                              <AlertTriangle size={13} />
                              <span className="zdb-inline-alert-sev">
                                {(hit.severity || 'ISSUE').toUpperCase()}
                              </span>
                              <span className="zdb-inline-alert-text">{hit.issue}</span>
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>

                  {topFileFinding && Object.keys(lineFindingMap).length === 0 && (
                    <div className={`zdb-inline-alert ${getSeverityClass((topFileFinding.severity || '').toUpperCase())}`}>
                      <AlertTriangle size={13} />
                      <span className="zdb-inline-alert-sev">
                        {(topFileFinding.severity || 'ISSUE').toUpperCase()}
                      </span>
                      <span className="zdb-inline-alert-text">{topFileFinding.issue}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="inspector-empty">
                  // Select a file from the explorer to preview or scan...
                </div>
              )}

              <div className="zdb-editor-footer">
                <span><GitBranch size={11} /> {branchName}*</span>
                <span>UTF-8</span>
                <span>LF</span>
                <span>Spaces: 4</span>
                <span className="zdb-editor-footer-status">
                  {loading
                    ? <><span className="zdb-spinner-sm" /> {loadingText || 'Analyzing…'}</>
                    : repoResults
                      ? <><Check size={11} color="var(--ok)" /> Analysis complete</>
                      : <><ScanLine size={11} /> Idle</>}
                </span>
              </div>
            </section>

            <section className="print-full-width panel threat-panel" data-pane="threats">
              <div className="no-print zdb-threat-head">
                <h3 className="scorecard-title">
                  <Shield size={16} color="var(--accent)" /> Threat Intelligence
                  <span className="zdb-count-badge">{sortedFindings.length}</span>
                </h3>
                <div className="zdb-threat-head-actions">
                  <button className="zdb-icon-btn" onClick={handleRunFullRepoAudit} disabled={loading || !selectedRepo} title="Re-run scan">
                    <Play size={13} />
                  </button>
                  <button className="zdb-icon-btn" title="More options">
                    <MoreHorizontal size={14} />
                  </button>
                </div>
              </div>

              <div className="print-only zdb-print-header" style={{ display: 'none' }}>
                <h1>Zero Day Buster — Executive Security Report</h1>
                <p>
                  {selectedRepo ? `${ownerLogin}/${selectedRepo.name}` : 'Repository'} · branch {branchName} ·
                  generated {new Date().toLocaleString()}
                </p>
              </div>

              {loading && (
                <div className="loading-card">
                  <span className="zdb-spinner-sm" /> {loadingText}
                  <div className="skeleton-row" />
                  <div className="skeleton-row" />
                  <div className="skeleton-row" />
                </div>
              )}

              {!loading && !repoResults && (
                <div className="empty-state">
                  No scan data yet.<br />
                  <strong>Run “Scan Repository”</strong> to build the threat scorecard.
                </div>
              )}

              {repoResults && (
                <>
                  <div className="zdb-risk-gauge-wrap">
                    <div className="zdb-risk-gauge-caption">
                      <span className="zdb-risk-gauge-label">Aggregate Risk Score</span>
                      <div className="zdb-risk-gauge-value">
                        <span className="zdb-risk-score">{Math.round(riskScore)}</span>
                        <span className="zdb-risk-max">/ 100</span>
                        <span className={`zdb-risk-band ${riskBand.cls}`}>{riskBand.label}</span>
                      </div>
                    </div>

                    <div className="zdb-risk-gauge">
                      <svg viewBox="0 0 132 74" width="132" height="68">
                        <path className="zdb-gauge-track" d="M 16 62 A 50 50 0 0 1 116 62" />
                        <path
                          className={`zdb-gauge-value ${riskBand.cls}`}
                          d="M 16 62 A 50 50 0 0 1 116 62"
                          strokeDasharray={gaugeCircumference}
                          strokeDashoffset={gaugeCircumference * (1 - Math.min(riskScore, 100) / 100)}
                        />
                      </svg>
                    </div>
                  </div>

                  <div className="zdb-severity-counts">
                    {[
                      { key: 'CRITICAL', label: 'CRIT', cls: 'critical' },
                      { key: 'HIGH', label: 'HIGH', cls: 'high' },
                      { key: 'MEDIUM', label: 'MED', cls: 'medium' },
                      { key: 'LOW', label: 'LOW', cls: 'low' },
                    ].map(s => (
                      <div className="zdb-sev-count" key={s.key}>
                        <span className={`zdb-sev-dot ${s.cls}`} />
                        <b>{severityCounts[s.key] || 0}</b>
                        <span className="zdb-sev-count-label">{s.label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="zdb-findings-head no-print">
                    <span>Open Findings</span>
                    <span className="dim mono">Sorted by CVSS</span>
                  </div>

                  {sortedFindings.length === 0 && (
                    <div className="empty-state">
                      No vulnerabilities detected in this scan.<br />
                      <strong>Clean run.</strong>
                    </div>
                  )}

                  {sortedFindings.map((item, idx) => {
                    const sevClass = getSeverityClass((item.severity || '').toUpperCase());
                    const isOpen = expandedFindingIdx === idx;
                    const ln = findingLineNumber(item);
                    return (
                      <div
                        key={idx}
                        className={`finding-card zdb-finding-acc ${sevClass} ${isOpen ? 'open' : ''}`}
                      >
                        <div
                          className="zdb-finding-acc-head"
                          onClick={() => setExpandedFindingIdx(isOpen ? -1 : idx)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === 'Enter') setExpandedFindingIdx(isOpen ? -1 : idx); }}
                        >
                          <ChevronRight size={14} className="zdb-acc-chevron" />
                          <span className="zdb-finding-acc-title">{item.issue}</span>
                          <span className={`zdb-cvss-pill ${sevClass}`}>CVSS {item.cvss ?? '—'}</span>
                        </div>

                        <div className={`zdb-finding-acc-body ${isOpen ? '' : 'zdb-collapsed'}`}>
                          <div className="zdb-finding-acc-meta">
                            <span className="mono dim">{findingId(item, idx)}</span>
                            <span className="zdb-dot-sep" />
                            {ln && <><span className="mono dim">Line {ln}</span><span className="zdb-dot-sep" /></>}
                            {item.cwe && <span className="zdb-cwe-badge">{item.cwe}</span>}
                            <span className={`severity-badge ${sevClass}`}>
                              {(item.severity || 'LOW').toUpperCase()}
                            </span>
                          </div>

                          {item.file_path && (
                            <button
                              className="zdb-file-jump"
                              onClick={() => openFileFromFinding(item.file_path)}
                              title="Open this file in the editor"
                            >
                              <FileCode size={12} /> {item.file_path}
                            </button>
                          )}

                          {(item.description || item.explanation || item.detail) && (
                            <div className="advice-box">
                              {item.description || item.explanation || item.detail}
                            </div>
                          )}

                          {item.fix && (
                            <div className="fix-box-wrap">
                              <p className="block-label">
                                <span>SUGGESTED PATCH</span>
                                <button
                                  className={`copy-btn ${copiedFindingIdx === idx ? 'copied' : ''}`}
                                  onClick={() => handleCopyFix(item.fix, idx)}
                                >
                                  {copiedFindingIdx === idx ? <Check size={11} /> : <Copy size={11} />}
                                </button>
                              </p>
                              <pre className="fix-box">{item.fix}</pre>
                            </div>
                          )}

                          <button
                            className="zdb-apply-btn no-print"
                            onClick={() => handleCopyFix(item.fix, idx)}
                            disabled={!item.fix}
                          >
                            {copiedFindingIdx === idx
                              ? <><ClipboardCheck size={14} /> Patch copied to clipboard</>
                              : <><Wand2 size={14} /> Apply remediation</>}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}