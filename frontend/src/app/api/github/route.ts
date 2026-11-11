import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  let token = searchParams.get('token');

  if (!token || token === 'undefined' || token === 'null' || token === '') {
    token = process.env.GITHUB_ACCESS_TOKEN || null;
  }

  if (!token) {
    return Response.json({ error: 'Token required' }, { status: 400 });
  }

  try {
    const response = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Neuravity-App'
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return Response.json({ 
        error: errorData.message || 'Failed to fetch repositories',
        status: response.status 
      }, { status: response.status });
    }

    const repos = await response.json();
    return Response.json(repos);
  } catch (error: any) {
    console.error('GitHub API error:', error);
    return Response.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let { token, owner, repo, path = '' } = await request.json();

  if (!token || token === 'undefined' || token === 'null' || token === '') {
    token = process.env.GITHUB_ACCESS_TOKEN || null;
  }

  if (!token || !owner || !repo) {
    return Response.json({ error: 'Missing required parameters' }, { status: 400 });
  }

  try {
    // Fetch repository contents
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Neuravity-App'
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return Response.json({ 
        error: errorData.message || 'Failed to fetch repository contents',
        status: response.status 
      }, { status: response.status });
    }

    const contents = await response.json();
    
    // Check if contents is an array
    if (!Array.isArray(contents)) {
      console.warn('GitHub API returned non-array:', contents);
      // If it's a single file object, wrap in array
      if (contents && typeof contents === 'object' && 'name' in contents) {
        return Response.json([createFileNode(contents)]);
      }
      return Response.json({ error: 'Repository structure not found or permission denied' }, { status: 404 });
    }
    
    // Process files and folders
    const processedContents = await Promise.all(
      contents.map(async (item: any) => {
        if (item.type === 'file') {
          try {
            // Fetch file content - handle binary or large files gracefully
            const fileResponse = await fetch(item.download_url);
            if (!fileResponse.ok) return null;
            const content = await fileResponse.text();
            
            return {
              name: item.name,
              type: 'file',
              path: item.path,
              content,
            };
          } catch (e) {
            console.error(`Error fetching file ${item.path}:`, e);
            return null;
          }
        } else if (item.type === 'dir') {
          return {
            name: item.name,
            type: 'folder',
            path: item.path,
            children: [],
          };
        }
        return null;
      })
    );

    return Response.json(processedContents.filter(Boolean));
  } catch (error: any) {
    console.error('GitHub API error:', error);
    return Response.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

function createFileNode(item: any) {
  return {
    name: item.name,
    type: 'file',
    path: item.path,
    content: '', // Content is fetched separately for files usually, or could be base64 in the object
  };
}
