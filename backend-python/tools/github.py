from github import Github
import os

def get_github_client():
    token = os.getenv("GITHUB_TOKEN")
    if not token:
        raise ValueError("GITHUB_TOKEN environment variable is missing")
    return Github(token)

def get_repo_issues(state: str = "open") -> list:
    """
    Fetch issues from AmbatuCode GitHub repository.
    
    Args:
        state: The state of the issue, can be 'open', 'closed', or 'all'.
    """
    g = get_github_client()
    repo_name = os.getenv("GITHUB_REPO")
    if not repo_name:
        return [{"error": "GITHUB_REPO environment variable is missing"}]
        
    repo = g.get_repo(repo_name)
    issues = repo.get_issues(state=state)
    
    return [
        {
            "number": issue.number,
            "title": issue.title,
            "state": issue.state,
            "labels": [l.name for l in issue.labels],
            "created_at": str(issue.created_at)
        }
        for issue in issues[:20]  # limit to 20
    ]

def create_github_issue(title: str, body: str, labels: list = []) -> dict:
    """
    Create a new issue on GitHub - useful for creating bug reports directly from coding sessions.
    
    Args:
        title: The title of the issue.
        body: Full description or bug report context.
        labels: List of labels (e.g. ['bug', 'accessibility']).
    """
    g = get_github_client()
    repo_name = os.getenv("GITHUB_REPO")
    if not repo_name:
        return {"error": "GITHUB_REPO environment variable is missing"}
        
    repo = g.get_repo(repo_name)
    issue = repo.create_issue(title=title, body=body, labels=labels)
    
    return {"issue_number": issue.number, "url": issue.html_url}

def get_recent_commits(branch: str = "main", limit: int = 10) -> list:
    """
    Get recent commits - very useful for establishing context for 'Where was I?'.
    
    Args:
        branch: The branch name.
        limit: Number of commits to retrieve.
    """
    g = get_github_client()
    repo_name = os.getenv("GITHUB_REPO")
    if not repo_name:
        return [{"error": "GITHUB_REPO environment variable is missing"}]
        
    repo = g.get_repo(repo_name)
    commits = repo.get_commits(sha=branch)
    
    return [
        {
            "sha": c.sha[:7],
            "message": c.commit.message,
            "author": c.commit.author.name,
            "date": str(c.commit.author.date)
        }
        for c in commits[:limit]
    ]

def get_file_content(file_path: str, branch: str = "main") -> str:
    """
    Read file content directly from the connected GitHub repository.
    
    Args:
        file_path: Path to the file, e.g. 'src/components/editor.tsx'.
        branch: The branch name.
    """
    g = get_github_client()
    repo_name = os.getenv("GITHUB_REPO")
    if not repo_name:
        return "Error: GITHUB_REPO environment variable is missing"
        
    repo = g.get_repo(repo_name)
    content = repo.get_contents(file_path, ref=branch)
    
    from base64 import b64decode
    return b64decode(content.content).decode("utf-8")
