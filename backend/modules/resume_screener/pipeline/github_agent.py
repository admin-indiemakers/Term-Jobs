"""
Stage 5 â€” GitHub / Portfolio Verification (Agentic Stage)
This is the one genuinely agentic stage: it fetches live data from the GitHub API,
decides what counts as relevant evidence, and synthesizes a structured signal.

Uses GitHub PAT from env for authenticated requests (5000 req/hr vs 60 unauthed).
"""
import logging
import re
from typing import List, Optional, Dict, Any

import httpx

from modules.resume_screener.config import get_settings
from modules.resume_screener.models.schemas import GitHubEvidence, GitHubRepo

logger = logging.getLogger(__name__)
settings = get_settings()

GITHUB_API = "https://api.github.com"

# Skills that leave verifiable traces in repos
VERIFIABLE_SKILLS = {
    "fastapi", "django", "flask", "express", "nodejs", "react", "vue", "angular",
    "python", "javascript", "typescript", "java", "go", "rust", "c++", "c#",
    "docker", "kubernetes", "terraform", "ansible",
    "postgresql", "mysql", "mongodb", "redis", "elasticsearch",
    "aws", "gcp", "azure",
    "pytorch", "tensorflow", "scikit-learn", "pandas", "numpy",
    "graphql", "restapi", "grpc",
    "kafka", "rabbitmq", "celery",
}

# Files / paths that indicate CI/CD
CI_SIGNALS = [
    ".github/workflows",
    ".travis.yml",
    "Jenkinsfile",
    ".circleci/config.yml",
    "azure-pipelines.yml",
    ".gitlab-ci.yml",
]

DOCKER_SIGNALS = ["Dockerfile", "docker-compose.yml", "docker-compose.yaml"]

RECENT_MONTHS = 12


import os

def _build_headers() -> Dict[str, str]:
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    token = os.getenv("GITHUB_PAT") or os.getenv("GITHUB_TOKEN") or getattr(settings, "github_pat", "")
    if token and token != "ghp_your_token_here":
        headers["Authorization"] = f"Bearer {token.strip()}"
    return headers


def _extract_username(url: str) -> Optional[str]:
    """Extract GitHub username from profile or repo URL â€” handles with/without https://."""
    match = re.search(r"(?:https?://)?(?:www\.)?github\.com/([A-Za-z0-9_-]+)", url, re.IGNORECASE)
    if match:
        username = match.group(1)
        if username.lower() not in ("features", "about", "pricing", "login", "signup", "orgs"):
            return username
    return None


async def _fetch_json(client: httpx.AsyncClient, url: str) -> Optional[Dict]:
    try:
        r = await client.get(url, headers=_build_headers(), timeout=15.0)
        if r.status_code == 404:
            return None
        if r.status_code == 403:
            logger.warning("GitHub API rate limit hit or authentication required")
            return None
        r.raise_for_status()
        return r.json()
    except Exception as e:
        logger.warning(f"GitHub API fetch failed for {url}: {e}")
        return None


async def _check_repo_files(
    client: httpx.AsyncClient,
    owner: str,
    repo: str,
) -> Dict[str, bool]:
    """
    Check if a repo contains Dockerfile, docker-compose, or CI files
    using the Git trees API (single request for the root tree).
    """
    tree_url = f"{GITHUB_API}/repos/{owner}/{repo}/git/trees/HEAD"
    tree_data = await _fetch_json(client, tree_url)
    if not tree_data:
        return {"docker": False, "ci": False}

    file_paths = {item["path"] for item in tree_data.get("tree", [])}

    docker = any(sig in file_paths for sig in DOCKER_SIGNALS)
    ci = any(sig.split("/")[0] in file_paths for sig in CI_SIGNALS)

    return {"docker": docker, "ci": ci}


async def _get_repo_languages(
    client: httpx.AsyncClient, owner: str, repo: str
) -> List[str]:
    """Return list of languages used in a repo."""
    url = f"{GITHUB_API}/repos/{owner}/{repo}/languages"
    data = await _fetch_json(client, url)
    return list(data.keys()) if data else []


def _detect_skills_from_repo(repo: Dict, languages: List[str], topics: List[str]) -> List[str]:
    """Identify verifiable skill signals from repo metadata."""
    signals = set()
    combined_text = (
        (repo.get("name") or "").lower()
        + " "
        + (repo.get("description") or "").lower()
        + " "
        + " ".join(t.lower() for t in topics)
        + " "
        + " ".join(l.lower() for l in languages)
    )
    for skill in VERIFIABLE_SKILLS:
        if skill in combined_text:
            signals.add(skill.title() if skill.islower() else skill)
    return list(signals)


def _is_recent(pushed_at: Optional[str]) -> bool:
    """Return True if the repo was pushed to within RECENT_MONTHS months."""
    if not pushed_at:
        return False
    import datetime
    try:
        pushed = datetime.datetime.fromisoformat(pushed_at.replace("Z", "+00:00"))
        cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(
            days=RECENT_MONTHS * 30
        )
        return pushed >= cutoff
    except Exception:
        return False


async def verify_github(github_url: str) -> GitHubEvidence:
    """
    Main agentic function: fetch profile + repos, detect evidence, return structured result.
    """
    username = _extract_username(github_url)
    if not username:
        return GitHubEvidence(verified=False, error=f"Could not extract username from: {github_url}")

    evidence = GitHubEvidence(
        verified=False,
        username=username,
        profile_url=f"https://github.com/{username}",
    )

    async with httpx.AsyncClient(timeout=20.0) as client:
        # Step 1: Fetch user profile
        profile = await _fetch_json(client, f"{GITHUB_API}/users/{username}")
        if not profile:
            evidence.error = f"GitHub user '{username}' not found or API unreachable"
            return evidence

        evidence.public_repos = profile.get("public_repos", 0)
        evidence.verified = True

        # Step 2: List repos sorted by recent activity
        repos_data = await _fetch_json(
            client,
            f"{GITHUB_API}/users/{username}/repos?sort=pushed&per_page=30",
        )
        if not repos_data or not isinstance(repos_data, list):
            return evidence

        top_repos: List[GitHubRepo] = []
        all_verified_skills: List[str] = []
        any_ci = False
        any_docker = False
        any_recent = False

        # Step 3: Fast parallel analysis of top repos (cap at 6 for speed)
        import asyncio

        async def _analyze_single_repo(repo):
            if repo.get("fork"):
                return None
            repo_name = repo.get("name", "")
            owner = repo.get("owner", {}).get("login", username)
            pushed_at = repo.get("pushed_at")
            topics = repo.get("topics") or []
            description = repo.get("description") or ""
            stars = repo.get("stargazers_count", 0)
            primary_lang = repo.get("language")

            languages = [primary_lang] if primary_lang else []
            has_docker = False
            has_ci = False

            try:
                lang_task = _get_repo_languages(client, owner, repo_name)
                file_task = _check_repo_files(client, owner, repo_name)
                lang_res, file_res = await asyncio.gather(lang_task, file_task, return_exceptions=True)
                if isinstance(lang_res, list) and lang_res:
                    languages = lang_res
                if isinstance(file_res, dict):
                    has_docker = file_res.get("docker", False)
                    has_ci = file_res.get("ci", False)
            except Exception:
                pass

            skills = _detect_skills_from_repo(repo, languages, topics)
            if primary_lang and primary_lang.title() not in skills:
                skills.append(primary_lang.title())

            recent = _is_recent(pushed_at)

            return (
                GitHubRepo(
                    name=repo_name,
                    url=f"https://github.com/{owner}/{repo_name}",
                    description=description,
                    languages=languages[:5],
                    topics=topics[:8],
                    has_dockerfile=has_docker,
                    has_ci=has_ci,
                    stars=stars,
                    recent_activity=recent,
                ),
                skills,
                has_ci,
                has_docker,
                recent
            )

        repo_results = await asyncio.gather(*(_analyze_single_repo(r) for r in repos_data[:6]), return_exceptions=True)
        for res in repo_results:
            if isinstance(res, tuple) and res[0] is not None:
                gh_repo, r_skills, r_ci, r_docker, r_recent = res
                top_repos.append(gh_repo)
                all_verified_skills.extend(r_skills)
                if r_ci: any_ci = True
                if r_docker: any_docker = True
                if r_recent: any_recent = True

        evidence.top_repos = top_repos[:5]  # Return top 5 in response
        evidence.verified_skills = list(set(all_verified_skills))
        evidence.ci_evidence = any_ci
        evidence.docker_evidence = any_docker
        evidence.recent_activity = any_recent

        # Step 4: Compute evidence score (0â€“100)
        score = 0.0
        if evidence.verified:
            score += 20  # Account exists
        if evidence.public_repos >= 5:
            score += 15
        elif evidence.public_repos >= 1:
            score += 8
        if any_recent:
            score += 20
        if any_ci:
            score += 20
        if any_docker:
            score += 15
        skill_bonus = min(10, len(evidence.verified_skills) * 2)
        score += skill_bonus

        evidence.evidence_score = min(100.0, score)

    return evidence

