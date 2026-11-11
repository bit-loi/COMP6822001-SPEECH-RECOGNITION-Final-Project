
export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
}

export interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
  bio: string | null;
  public_repos: number;
  followers: number;
  following: number;
}

const BACKEND_URL = 'http://localhost:3001/api/git';

export class GitHubService {
  // Token is managed in Backend

  async getUser(): Promise<GitHubUser> {
    const res = await fetch(`${BACKEND_URL}/user`);
    if (!res.ok) throw new Error('Failed to fetch user');
    return res.json();
  }

  async getUserRepos(options?: {
    sort?: 'created' | 'updated' | 'pushed' | 'full_name';
    direction?: 'asc' | 'desc';
    per_page?: number;
  }): Promise<GitHubRepo[]> {
    const params = new URLSearchParams(options as any);
    const res = await fetch(`${BACKEND_URL}/user/repos?${params}`);
    if (!res.ok) throw new Error('Failed to fetch repos');
    return res.json();
  }

  async getRepo(owner: string, repo: string): Promise<GitHubRepo> {
    const res = await fetch(`${BACKEND_URL}/repos/${owner}/${repo}`);
    return res.json();
  }

  async getRepoContents(owner: string, repo: string, path: string = '') {
    const res = await fetch(`${BACKEND_URL}/repos/${owner}/${repo}/contents?path=${path}`);
    return res.json();
  }

  async getFileContent(owner: string, repo: string, path: string): Promise<string> {
    const res = await fetch(`${BACKEND_URL}/repos/${owner}/${repo}/file?path=${path}`);
    const data = await res.json();
    return data.content || ''; // backend checks decode
  }

  async createOrUpdateFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    sha?: string
  ) {
    const res = await fetch(`${BACKEND_URL}/repos/${owner}/${repo}/file`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ path, content, message, sha })
    });
    return res.json();
  }

  async searchRepos(query: string, per_page: number = 10) {
    const res = await fetch(`${BACKEND_URL}/repos/search?q=${encodeURIComponent(query)}&per_page=${per_page}`);
    return res.json();
  }
}
