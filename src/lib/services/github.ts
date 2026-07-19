import pLimit from 'p-limit';

const GITHUB_PAT = process.env.GITHUB_PAT;

export interface GithubFile {
  path: string;
  content: string;
}

export class GithubService {
  /**
   * Parse a GitHub URL to extract owner and repo
   */
  static parseUrl(url: string): { owner: string; repo: string } {
    try {
      const parsed = new URL(url);
      if (parsed.hostname !== 'github.com') {
        throw new Error('Not a valid GitHub URL');
      }
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts.length < 2) {
        throw new Error('Invalid GitHub URL format');
      }
      return { owner: parts[0], repo: parts[1] };
    } catch (e) {
      throw new Error(`Failed to parse GitHub URL: ${url}`);
    }
  }

  /**
   * Fetch default branch of the repository
   */
  static async getDefaultBranch(owner: string, repo: string): Promise<string> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'CodebaseWhisperer',
    };
    if (GITHUB_PAT) {
      headers.Authorization = `token ${GITHUB_PAT}`;
    }

    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    if (!res.ok) {
      throw new Error(`Failed to fetch repo info: ${res.statusText}`);
    }
    const data = await res.json();
    return data.default_branch || 'main';
  }

  /**
   * Fetch the repository tree and filter out unwanted files
   */
  static async getRepositoryTree(owner: string, repo: string, branch: string): Promise<string[]> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'CodebaseWhisperer',
    };
    if (GITHUB_PAT) {
      headers.Authorization = `token ${GITHUB_PAT}`;
    }

    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, { headers });
    if (!res.ok) {
      throw new Error(`Failed to fetch repo tree: ${res.statusText}`);
    }

    const data = await res.json();
    if (data.truncated) {
      console.warn('Warning: Repository tree is truncated');
    }

    const filePaths = data.tree
      .filter((node: any) => node.type === 'blob')
      .map((node: any) => node.path as string);

    // Filter out unwanted files and directories
    const excludeDirs = ['node_modules', 'dist', 'build', '__pycache__', '.git', '.next'];
    const excludeExts = ['.jpg', '.jpeg', '.png', '.gif', '.ico', '.pdf', '.zip', '.tar', '.gz', '.mp4', '.woff', '.ttf'];

    return filePaths.filter((filePath: string) => {
      const parts = filePath.split('/');
      
      // Check if any part of the path is an excluded directory
      if (parts.some((part: string) => excludeDirs.includes(part) || part.startsWith('.'))) {
        return false;
      }

      // Check extensions
      const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
      if (excludeExts.includes(ext)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Fetch raw file contents concurrently
   */
  static async fetchRawFiles(owner: string, repo: string, branch: string, filePaths: string[]): Promise<GithubFile[]> {
    const limit = pLimit(10); // Limit concurrency to 10 to avoid rate limits
    const files: GithubFile[] = [];

    const headers: Record<string, string> = {};
    if (GITHUB_PAT) {
      headers.Authorization = `token ${GITHUB_PAT}`;
    }

    const fetchPromises = filePaths.map((filePath) =>
      limit(async () => {
        try {
          const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
          const res = await fetch(url, { headers });
          if (!res.ok) {
            console.warn(`Failed to fetch raw content for ${filePath}: ${res.statusText}`);
            return null;
          }
          const content = await res.text();
          return { path: filePath, content };
        } catch (error) {
          console.error(`Error fetching ${filePath}:`, error);
          return null;
        }
      })
    );

    const results = await Promise.all(fetchPromises);
    
    for (const result of results) {
      if (result !== null) {
        files.push(result);
      }
    }

    return files;
  }
}
