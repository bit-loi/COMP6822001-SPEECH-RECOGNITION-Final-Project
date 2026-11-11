from fastapi import APIRouter, Depends, HTTPException, Header
import requests
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dependencies.auth import verify_user

router = APIRouter(prefix="/github", tags=["GitHub Integration"])

@router.get("/repos")
async def list_github_repos(
    user = Depends(verify_user), 
    github_token: str = Header(None, description="GitHub Provider Token from Frontend")
):
    """
    Mengambil repositori dari GitHub untuk user yang sudah terauntentikasi Supabase.
    Memerlukan token GitHub (provider_token) yang didapat frontend saat Supabase GitHub OAuth Login.
    """
    # Fallback to local .env if none provided (for development without frontend full flow)
    if not github_token:
        github_token = os.getenv("GITHUB_ACCESS_TOKEN")
        
    if not github_token:
        raise HTTPException(
            status_code=400, 
            detail="GitHub Access Token is required. Please sign in with GitHub via Supabase in Frontend."
        )
        
    headers = {
        "Authorization": f"Bearer {github_token}",
        "Accept": "application/vnd.github.v3+json"
    }
    
    response = requests.get("https://api.github.com/user/repos?sort=updated&per_page=15", headers=headers)
    
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=f"Failed to fetch repos from GitHub: {response.text}")
        
    repos = response.json()
    
    formatted_repos = []
    for r in repos:
        formatted_repos.append({
            "id": r["id"],
            "name": r["name"],
            "full_name": r["full_name"],
            "url": r["html_url"],
            "private": r["private"],
            "pushed_at": r["pushed_at"]
        })
        
    return {
        "user_id": user.id,
        "total_repos_fetched": len(formatted_repos),
        "repos": formatted_repos
    }
