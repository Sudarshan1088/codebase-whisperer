import AdmZip from 'adm-zip';

const GITHUB_PAT = process.env.GITHUB_PAT;

export interface GithubFile {
  path: string;
  content: string;
}

// ─── Exclusion filters ─────────────────────────────────────────────
const EXCLUDED_DIRS = new Set([
  'node_modules', 'dist', 'build', '.git', '.next', '.nuxt',
  '__pycache__', '.cache', 'coverage', '.idea', '.vscode',
  'vendor', '.svn', '.hg',
]);

const EXCLUDED_EXTENSIONS = new Set([
  // Images
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.bmp', '.webp',
  // Binaries / archives
  '.pdf', '.exe', '.dll', '.zip', '.tar', '.gz', '.7z', '.rar',
  '.bin', '.so', '.dylib', '.woff', '.woff2', '.ttf', '.eot', '.otf',
  // Media
  '.mp3', '.mp4', '.avi', '.mov', '.wav', '.ogg', '.flac',
  // Minified assets
  '.min.js', '.min.css',
  // Maps
  '.map',
]);

const EXCLUDED_FILENAMES = new Set([
  'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock',
  '.DS_Store', 'Thumbs.db',
]);

/** Max file count to ingest from a single repo. */
const MAX_FILES = 500;

// ─── Helpers ────────────────────────────────────────────────────────
function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'CodebaseWhisperer',
  };
  if (GITHUB_PAT) {
    headers.Authorization = `token ${GITHUB_PAT}`;
  }
  return headers;
}

function shouldExclude(filePath: string): boolean {
  const segments = filePath.split('/');
  const fileName = segments[segments.length - 1];

  // Excluded directories
  if (segments.some((seg) => EXCLUDED_DIRS.has(seg) || seg.startsWith('.'))) {
    return true;
  }

  // Excluded exact filenames
  if (EXCLUDED_FILENAMES.has(fileName)) {
    return true;
  }

  // Excluded extensions (check .min.js / .min.css first, then normal ext)
  const lowerPath = filePath.toLowerCase();
  if (lowerPath.endsWith('.min.js') || lowerPath.endsWith('.min.css')) {
    return true;
  }

  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex !== -1) {
    const ext = fileName.substring(dotIndex).toLowerCase();
    if (EXCLUDED_EXTENSIONS.has(ext)) {
      return true;
    }
  }

  return false;
}

/**
 * Quick heuristic to skip binary-looking buffers before attempting
 * UTF-8 decode. Checks the first 8KB for null bytes.
 */
function looksLikeBinary(buf: Buffer): boolean {
  const checkLen = Math.min(buf.length, 8192);
  for (let i = 0; i < checkLen; i++) {
    if (buf[i] === 0) return true;
  }
  return false;
}

// ─── Service ────────────────────────────────────────────────────────
export class GithubService {
  /**
   * Parse a GitHub URL to extract owner and repo.
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
   * Download the default-branch zipball in a single HTTP request,
   * decompress in-memory, filter, and return structured file objects.
   *
   * This replaces the previous 3-step flow:
   *   getDefaultBranch() → getRepositoryTree() → fetchRawFiles()
   * with a single network round-trip.
   */
  static async fetchRepoAsZip(owner: string, repo: string): Promise<GithubFile[]> {
    const headers = getHeaders();

    // ── Download zipball (GitHub redirects to a CDN URL) ──
    const zipUrl = `https://api.github.com/repos/${owner}/${repo}/zipball`;
    const res = await fetch(zipUrl, {
      headers,
      redirect: 'follow',
    });

    if (!res.ok) {
      throw new Error(
        `Failed to download zipball for ${owner}/${repo}: ${res.status} ${res.statusText}`,
      );
    }

    const arrayBuffer = await res.arrayBuffer();
    const zipBuffer = Buffer.from(arrayBuffer);

    // ── Decompress in-memory ──
    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();

    const files: GithubFile[] = [];

    for (const entry of entries) {
      // Skip directories
      if (entry.isDirectory) continue;

      // The zip root is always `owner-repo-commitHash/`
      // Strip this prefix to get the real repo-relative path.
      const fullPath = entry.entryName;
      const slashIndex = fullPath.indexOf('/');
      if (slashIndex === -1) continue; // shouldn't happen, but guard
      const relativePath = fullPath.substring(slashIndex + 1);

      // Skip empty paths (root-level artifacts)
      if (!relativePath) continue;

      // Apply exclusion filters
      if (shouldExclude(relativePath)) continue;

      // Skip binary files
      const data = entry.getData();
      if (data.length === 0) continue;
      if (looksLikeBinary(data)) continue;

      // Decode as UTF-8
      const content = data.toString('utf8');

      files.push({ path: relativePath, content });

      // Cap at MAX_FILES
      if (files.length >= MAX_FILES) {
        console.warn(`[GitHub] Capped at ${MAX_FILES} files for ${owner}/${repo}`);
        break;
      }
    }

    return files;
  }

  // ── Legacy methods (kept for potential other consumers) ────────────

  /**
   * Fetch the default branch name for a repository.
   */
  static async getDefaultBranch(owner: string, repo: string): Promise<string> {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}`,
      { headers: getHeaders() },
    );
    if (!res.ok) {
      throw new Error(`Failed to fetch repo info: ${res.statusText}`);
    }
    const data = await res.json();
    return data.default_branch || 'main';
  }
}
