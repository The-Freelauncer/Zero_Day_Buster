import os
import json
import httpx
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
import tree_sitter
from tree_sitter import Language, Parser
import tree_sitter_python as tspython

router = APIRouter()

# Strictly read from environment variables (No hardcoded fallback secrets)
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate")

PY_LANGUAGE = Language(tspython.language())
parser = Parser()

if hasattr(parser, "set_language"):
    parser.set_language(PY_LANGUAGE)
else:
    parser.language = PY_LANGUAGE

class RepoAuditRequest(BaseModel):
    owner: str
    repo: str

class FileAuditRequest(BaseModel):
    owner: str
    repo: str
    path: str

class OAuthRequest(BaseModel):
    code: str

def extract_bearer_token(authorization: str) -> str:
    """Helper to extract token from 'Bearer <token>' header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    return authorization.replace("Bearer ", "").strip()

@router.post("/auth/github")
async def github_auth(data: OAuthRequest):
    if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="GitHub OAuth credentials not configured on server")

    async with httpx.AsyncClient() as client:
        res = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": data.code,
            },
        )
        try:
            token_data = res.json()
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid GitHub response")

        if "access_token" not in token_data:
            raise HTTPException(
                status_code=400, 
                detail=token_data.get("error_description", "Code already consumed or invalid")
            )

        return {"token": token_data["access_token"]}

@router.get("/github/repos")
async def get_user_repos(authorization: str = Header(...)):
    token = extract_bearer_token(authorization)
    async with httpx.AsyncClient() as client:
        res = await client.get(
            "https://api.github.com/user/repos?sort=updated&per_page=20",
            headers={"Authorization": f"token {token}"}
        )
        return res.json()

@router.get("/github/tree")
async def get_repo_tree(owner: str, repo: str, authorization: str = Header(...)):
    token = extract_bearer_token(authorization)
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"https://api.github.com/repos/{owner}/{repo}/git/trees/main?recursive=1",
            headers={"Authorization": f"token {token}"}
        )
        data = res.json()
        supported_exts = ('.py', '.js', '.ts', '.html', '.cpp', '.c', '.java', '.php', '.go')
        files = [item for item in data.get("tree", []) if item.get("path", "").endswith(supported_exts)]
        return {"files": files}

@router.get("/github/file")
async def get_file_content(owner: str, repo: str, path: str, authorization: str = Header(...)):
    token = extract_bearer_token(authorization)
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"https://raw.githubusercontent.com/{owner}/{repo}/main/{path}",
            headers={"Authorization": f"token {token}"}
        )
        return {"content": res.text}

@router.post("/audit-file")
async def audit_single_file(req: FileAuditRequest, authorization: str = Header(...)):
    token = extract_bearer_token(authorization)
    async with httpx.AsyncClient(timeout=120.0) as client:
        res = await client.get(
            f"https://raw.githubusercontent.com/{req.owner}/{req.repo}/main/{req.path}",
            headers={"Authorization": f"token {token}"}
        )
        code = res.text
        if not code or not code.strip():
            return {"scanned_files": 1, "total_vulnerabilities": 0, "findings": []}

        truncated_code = code[:4000] if len(code) > 4000 else code
        prompt = f"Audit file ({req.path}) for security bugs:\n```\n{truncated_code}\n```"
        payload = {
            "model": "local-sec-reviewer",
            "prompt": prompt,
            "stream": False,
            "format": "json"
        }

        all_findings = []
        try:
            resp = await client.post(OLLAMA_URL, json=payload)
            if resp.status_code == 200:
                raw_response = resp.json().get("response", "{}")
                analysis = json.loads(raw_response)
                if isinstance(analysis, dict) and analysis.get("vulnerable"):
                    analysis["file_path"] = req.path
                    analysis["severity"] = str(analysis.get("severity", "MEDIUM")).upper()
                    analysis["cvss"] = str(analysis.get("cvss", "7.0"))
                    all_findings.append(analysis)
        except Exception as e:
            print(f"[-] Error auditing file {req.path}: {e}")

    return {
        "scanned_files": 1,
        "total_vulnerabilities": len(all_findings),
        "findings": all_findings
    }

@router.post("/audit-repo")
async def audit_full_repo(req: RepoAuditRequest, authorization: str = Header(...)):
    token = extract_bearer_token(authorization)
    tree_res = await get_repo_tree(req.owner, req.repo, authorization=f"Bearer {token}")
    files = tree_res.get("files", [])

    all_findings = []
    scanned_files_count = 0
    timeout_config = httpx.Timeout(300.0, connect=10.0)

    async with httpx.AsyncClient(timeout=timeout_config) as client:
        for file_info in files:
            path = file_info.get("path")
            try:
                res = await client.get(
                    f"https://raw.githubusercontent.com/{req.owner}/{req.repo}/main/{path}",
                    headers={"Authorization": f"token {token}"}
                )
                code = res.text
                if not code or not code.strip():
                    continue

                scanned_files_count += 1
                truncated_code = code[:4000] if len(code) > 4000 else code

                prompt = f"Audit file ({path}) for security bugs:\n```\n{truncated_code}\n```"
                payload = {
                    "model": "local-sec-reviewer",
                    "prompt": prompt,
                    "stream": False,
                    "format": "json"
                }

                resp = await client.post(OLLAMA_URL, json=payload)
                if resp.status_code == 200:
                    raw_response = resp.json().get("response", "{}")
                    try:
                        analysis = json.loads(raw_response)
                        if isinstance(analysis, dict) and analysis.get("vulnerable"):
                            analysis["file_path"] = path
                            analysis["severity"] = str(analysis.get("severity", "MEDIUM")).upper()
                            analysis["cvss"] = str(analysis.get("cvss", "7.0"))
                            all_findings.append(analysis)
                    except json.JSONDecodeError:
                        pass
            except Exception as e:
                print(f"[-] Skipped file {path} due to error: {e}")

    return {
        "scanned_files": scanned_files_count,
        "total_vulnerabilities": len(all_findings),
        "findings": all_findings
    }