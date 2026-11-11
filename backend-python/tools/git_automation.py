import subprocess
import os

def git_status(repo_path: str = ".") -> dict:
    """
    Check local git repository status to list what files have changed.
    
    Args:
        repo_path: Path to the local git repository.
    """
    result = subprocess.run(
        ["git", "status", "--porcelain"],
        cwd=repo_path,
        capture_output=True,
        text=True
    )
    
    files = []
    for line in result.stdout.strip().split("\n"):
        if line:
            status = line[:2].strip()
            file = line[3:]
            files.append({"status": status, "file": file})
    
    return {
        "changed_files": files,
        "total": len(files),
        "has_changes": len(files) > 0
    }

def git_add(files: list = None, repo_path: str = ".") -> dict:
    """
    Stage files for a future commit.
    
    Args:
        files: List of files to stage. Leave empty or pass None to add all.
        repo_path: Path to the local git repository.
    """
    if files:
        cmd = ["git", "add"] + files
    else:
        cmd = ["git", "add", "."]
    
    result = subprocess.run(cmd, cwd=repo_path, capture_output=True, text=True)
    
    return {
        "success": result.returncode == 0,
        "message": result.stdout or result.stderr
    }

def git_commit(message: str, repo_path: str = ".") -> dict:
    """
    Commit the staged changes with a descriptive message.
    
    Args:
        message: The commit message to attach.
        repo_path: Path to the local git repository.
    """
    result = subprocess.run(
        ["git", "commit", "-m", message],
        cwd=repo_path,
        capture_output=True,
        text=True
    )
    
    return {
        "success": result.returncode == 0,
        "message": result.stdout or result.stderr,
        "commit_message": message
    }

def git_push(branch: str = "main", repo_path: str = ".") -> dict:
    """
    Push local commits to the remote GitHub repository.
    
    Args:
        branch: The branch name to push to.
        repo_path: Path to the local git repository.
    """
    result = subprocess.run(
        ["git", "push", "origin", branch],
        cwd=repo_path,
        capture_output=True,
        text=True
    )
    
    return {
        "success": result.returncode == 0,
        "message": result.stdout or result.stderr,
        "branch": branch
    }

def git_pull(branch: str = "main", repo_path: str = ".") -> dict:
    """
    Pull latest changes from the remote GitHub repository to avoid merge conflicts.
    
    Args:
        branch: The branch name to pull from.
        repo_path: Path to the local git repository.
    """
    result = subprocess.run(
        ["git", "pull", "origin", branch],
        cwd=repo_path,
        capture_output=True,
        text=True
    )
    return {
        "success": result.returncode == 0, 
        "message": result.stdout or result.stderr
    }

def git_create_branch(branch_name: str, repo_path: str = ".") -> dict:
    """
    Create a new git branch locally and switch to it.
    
    Args:
        branch_name: Name of the new local branch to create.
        repo_path: Path to the local git repository.
    """
    result = subprocess.run(
        ["git", "checkout", "-b", branch_name],
        cwd=repo_path,
        capture_output=True,
        text=True
    )
    return {
        "success": result.returncode == 0, 
        "branch": branch_name
    }

def git_diff(repo_path: str = ".") -> str:
    """
    View uncommitted code changes in order to write an accurate commit message.
    
    Args:
        repo_path: Path to the local git repository.
    """
    result = subprocess.run(
        ["git", "diff", "--staged"],
        cwd=repo_path,
        capture_output=True,
        text=True
    )
    
    if not result.stdout:
        result = subprocess.run(
            ["git", "diff"],
            cwd=repo_path,
            capture_output=True,
            text=True
        )
    
    # Return first 3000 chars to avoid prompt limits
    return result.stdout[:3000]

def generate_commit_message(diff: str, files: list) -> str:
    """
    Helper function to generate a conventional commit message.
    """
    import google.generativeai as genai
    
    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
    model = genai.GenerativeModel("gemini-2.0-flash")
    
    prompt = f"""Generate a concise git commit message (conventional commits format) 
    based on these changes:
    
    Files changed: {', '.join(files)}
    
    Diff preview:
    {diff[:1500]}
    
    Format: type(scope): short description
    Types: feat, fix, docs, style, refactor, chore
    Keep it under 72 characters. Only return the commit message, nothing else."""
    
    try:
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        return f"chore(automated): commit by agent (error generating detailed message: {str(e)[:50]})"

def auto_commit_and_push(
    repo_path: str = ".",
    branch: str = "main",
    commit_message: str = None
) -> dict:
    """
    AGENT TOOL: Automatically discover changes, stage, commit, and push.
    AI Agent will automatically generate a descriptive commit message from diff if none is provided.
    
    Args:
        repo_path: Path to the local git repository.
        branch: Target remote push branch.
        commit_message: Explicit commit message (optional).
    """
    status = git_status(repo_path)
    if not status["has_changes"]:
        return {"success": False, "message": "No changes to commit found."}
    
    diff = git_diff(repo_path)
    
    if not commit_message:
        files_changed = [f["file"] for f in status["changed_files"]]
        commit_message = generate_commit_message(diff, files_changed)
    
    add_result = git_add(repo_path=repo_path)
    if not add_result["success"]:
        return {"success": False, "step": "add", "error": add_result["message"]}
    
    commit_result = git_commit(commit_message, repo_path)
    if not commit_result["success"]:
        return {"success": False, "step": "commit", "error": commit_result["message"]}
    
    push_result = git_push(branch, repo_path)
    
    return {
        "success": push_result["success"],
        "commit_message": commit_message,
        "files_pushed": status["changed_files"],
        "branch": branch,
        "message": push_result["message"]
    }
