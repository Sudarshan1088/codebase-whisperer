const fs = require('fs');
const path = require('path');
const https = require('https');

const wasmDir = path.join(process.cwd(), 'public', 'wasm');

// Ensure the directory public/wasm exists
if (!fs.existsSync(wasmDir)) {
  fs.mkdirSync(wasmDir, { recursive: true });
}

const baseUrl = 'https://github.com/tree-sitter';

const targets = [
  {
    name: 'tree-sitter.wasm',
    url: 'https://unpkg.com/web-tree-sitter@0.22.6/tree-sitter.wasm'
  },
  {
    name: 'tree-sitter-javascript.wasm',
    url: `${baseUrl}/tree-sitter-javascript/releases/latest/download/tree-sitter-javascript.wasm`
  },
  {
    name: 'tree-sitter-typescript.wasm',
    url: `${baseUrl}/tree-sitter-typescript/releases/latest/download/tree-sitter-typescript.wasm`
  },
  {
    name: 'tree-sitter-tsx.wasm',
    url: `${baseUrl}/tree-sitter-typescript/releases/latest/download/tree-sitter-tsx.wasm`
  },
  {
    name: 'tree-sitter-python.wasm',
    url: `${baseUrl}/tree-sitter-python/releases/latest/download/tree-sitter-python.wasm`
  },
  {
    name: 'tree-sitter-java.wasm',
    url: `${baseUrl}/tree-sitter-java/releases/latest/download/tree-sitter-java.wasm`
  },
  {
    name: 'tree-sitter-cpp.wasm',
    url: `${baseUrl}/tree-sitter-cpp/releases/latest/download/tree-sitter-cpp.wasm`
  },
  {
    name: 'tree-sitter-go.wasm',
    url: `${baseUrl}/tree-sitter-go/releases/latest/download/tree-sitter-go.wasm`
  },
  {
    name: 'tree-sitter-rust.wasm',
    url: `${baseUrl}/tree-sitter-rust/releases/latest/download/tree-sitter-rust.wasm`
  }
];

/**
 * Downloads a file from a URL to a specified destination, handling 301/302 redirects.
 */
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'CodebaseWhisperer-NodeJS' } }, (response) => {
      // Handle redirects (e.g., GitHub to AWS S3)
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (!redirectUrl) {
          return reject(new Error('Redirect location header missing'));
        }
        return downloadFile(redirectUrl, dest).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        return reject(new Error(`HTTP Status Code: ${response.statusCode} for URL: ${url}`));
      }

      const file = fs.createWriteStream(dest);
      response.pipe(file);

      file.on('finish', () => {
        file.close(resolve);
      });

      file.on('error', (err) => {
        fs.unlink(dest, () => reject(err)); // Delete the file if an error occurs
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function main() {
  console.log(`Ensuring WASM directory exists at: ${wasmDir}`);
  
  for (const target of targets) {
    const dest = path.join(wasmDir, target.name);
    console.log(`Downloading ${target.name}...`);
    try {
      await downloadFile(target.url, dest);
      console.log(`✅ Successfully downloaded ${target.name}`);
    } catch (error) {
      console.error(`❌ Error downloading ${target.name}:`, error.message);
    }
  }
  
  console.log('Finished downloading WASM binaries.');
}

main();
