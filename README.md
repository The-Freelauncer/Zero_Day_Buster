# 🛡️ Zero Day Buster (ZDB)

**Zero Day Buster** is an autonomous, local-first Code Security & Static Application Security Testing (SAST) platform. Powered by an offline, fine-tuned **Qwen2.5-Coder** LLM operating via Ollama, ZDB analyzes Abstract Syntax Trees (AST) and source code files to detect zero-day threats, OWASP Top 10 vulnerabilities, and CWE-classified security bugs without sending code to remote cloud APIs.

---

## ✨ Features

- **🔒 100% Offline & Air-Gapped:** Zero external API calls. Your code, telemetry, and vulnerability findings never leave your local machine or GPU.
- **⚡ Dual-Mode Scanning Engine:**
  - **Single-File Targeted Scan:** Rapidly audit an individual source file in seconds without locking local GPU resources.
  - **Full Repository Sweeps:** Walk and evaluate supported source files recursively across your workspace.
- **🧠 AST-Aware Neural Reasoning:** Combines syntax tree structural analysis with local LLM reasoning to significantly reduce false positive rates.
- **📊 Interactive Security Dashboard:** Dark-mode IDE console with live file explorer, inline line-number code preview, and real-time vulnerability annotations.
- **📄 Executive PDF Reporting:** Export client-ready, one-click security audit reports directly from your browser.
- **🌐 Polyglot Language Support:** Scans Python, JavaScript, TypeScript, C/C++, Java, Go, PHP, HTML/CSS, and structured data configs.

---

## 🛠️ Tech Stack & Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                   React + Vite Frontend                     │
│  - Interactive Command Deck UI & Dark IDE Inspector          │
│  - Dynamic File Tree Explorer & Single/Full Audit Triggers  │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / REST (port 5173 -> 8000)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI Python Backend                   │
│  - GitHub OAuth & Tree-Sitter AST Parsing                   │
│  - Async HTTPX Request Pipeline with extended timeouts       │
└──────────────────────────────┬──────────────────────────────┘
                               │ Async HTTP JSON (port 11434)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  Local Ollama GPU Inference                 │
│  - Model: local-sec-reviewer (Qwen2.5-Coder-7B GGUF)        │
│  - In-Memory Resident Weights & Structured JSON Outputs     │
└─────────────────────────────────────────────────────────────┘


💻 Hardware & Prerequisites
Minimum Requirements
OS: macOS 12+, Linux (Ubuntu 22.04+), or Windows 11 (WSL2 / PowerShell)

RAM: 8 GB

GPU: 4 GB+ VRAM (NVIDIA CUDA / Apple Silicon M-Series) for smooth local inference

Software:

Node.js (v18.0 or higher)

Python (v3.10 or higher)

Ollama (v0.1.30 or higher)

🧠 Model Weights Setup (Hugging Face / Ollama)
The system relies on a GGUF-quantized security reviewer model (local-sec-reviewer).

Option 1: Direct Pull from Hugging Face Hub (Recommended)
Run this command in your terminal to register the model directly via Ollama:

```

## 🧠 Model Download & Setup

### 1. Direct Pull with Ollama (Recommended)
Run the model directly from Hugging Face using Ollama in a single command:

```bash
ollama run hf.co/the-freelauncer/Zero_Day_Hunter:Q4_K_M
```


Build and register the model image:

```bash
ollama create local-sec-reviewer -f Modelfile

```

🔑 GitHub OAuth Setup
To enable repository browsing and single-click file fetching, register a GitHub OAuth App:

1.Go to your GitHub Settings → Developer Settings → OAuth Apps → New OAuth App.
2.Fill in the following application settings:
3.Application Name: ```Zero Day Buster ```
4.Homepage URL: ```http://localhost:5173```
5.Authorization Callback URL: ```http://localhost:5173```

Click Register Application.
Copy your Client ID and generate a new Client Secret. Keep these ready for step 2 in the Quickstart guide below.

🚀 Quickstart & Setup Guide
1. Clone the Repository

```bash
git clone https://github.com/The-Freelauncer/Zero_Day_Buster.git
```
2. Configure Environment Variables
Create a .env file inside the backend/ directory:

```bash
GITHUB_CLIENT_ID=your_github_oauth_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_client_secret
OLLAMA_URL=http://localhost:11434/api/generate
```
Frontend Configuration:
Create a .env file inside the frontend/ directory:
``` bash
VITE_API_BASE=http://localhost:8000/api
VITE_GITHUB_CLIENT_ID=your_github_oauth_client_id
```

3. Setup Backend (FastAPI)

```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
python -m venv .venv

# On Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# On macOS/Linux:
# source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start FastAPI server
python main.py
```

4. Setup Frontend (React + Vite)
Open a new terminal tab:

```bash
# Navigate to frontend directory
cd frontend

# Install Node dependencies
npm install

# Start Vite development server
npm run dev
```

Frontend app will run on http://localhost:5173

📁 Repository Structure: 

```bash
Zero_Day_Buster/
├── backend/
│   ├── main.py            # FastAPI Application Entrypoint & CORS setup
│   ├── router.py          # GitHub OAuth, Tree-Sitter & Audit Endpoints
│   └── requirements.txt    # Python dependencies (fastapi, httpx, uvicorn, tree-sitter)
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # Command Deck UI Layout & State Machine
│   │   ├── main.jsx       # React DOM entrypoint
│   │   └── index.css      # Custom Dark Slate Theme Styles
│   ├── package.json       # Frontend dependencies (React, Lucide icons, Axios)
│   └── vite.config.js     # Vite dev server configuration
└── README.md              # Project Documentation

```
