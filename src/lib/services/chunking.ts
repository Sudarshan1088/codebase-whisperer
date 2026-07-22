const TreeSitter = require('web-tree-sitter');
const Parser = TreeSitter.Parser;
const Language = TreeSitter.Language;
import path from 'path';

export interface Chunk {
  code_content: string;
  node_type: string;
  node_name: string;
  start_line: number;
  end_line: number;
}

export class ChunkingService {
  private static parserInitialized = false;
  private static parsers: Record<string, any> = {};
  private static parserInstance: any = null;

  static async init() {
    if (this.parserInitialized) return;
    // @ts-ignore
    await Parser.init({
      locateFile(scriptName: string) {
        return path.join(process.cwd(), 'node_modules', 'web-tree-sitter', scriptName);
      }
    });
    // @ts-ignore
    this.parserInstance = new Parser();
    this.parserInitialized = true;
  }

  private static async getLanguage(extension: string) {
    if (this.parsers[extension]) return this.parsers[extension];

    const wasmDir = path.join(process.cwd(), 'public', 'wasm');
    let wasmFile = '';

    switch (extension) {
      case '.ts':
        wasmFile = 'tree-sitter-typescript.wasm';
        break;
      case '.tsx':
        wasmFile = 'tree-sitter-tsx.wasm';
        break;
      case '.js':
      case '.jsx':
        wasmFile = 'tree-sitter-javascript.wasm';
        break;
      case '.py':
        wasmFile = 'tree-sitter-python.wasm';
        break;
      default:
        return null; // Unsupported language for AST parsing
    }

    try {
      const wasmPath = path.join(wasmDir, wasmFile);
      // @ts-ignore
      const language = await Language.load(wasmPath);
      this.parsers[extension] = language;
      return language;
    } catch (e) {
      console.warn(`Failed to load WASM for ${extension}:`, e);
      return null;
    }
  }

  /**
   * Split text recursively if AST parsing fails or language is unsupported
   */
  static fallbackChunking(code: string, maxChunkSize = 1500, overlap = 200): Chunk[] {
    const chunks: Chunk[] = [];
    let lines = code.split('\n');
    let currentChunk = '';
    let startLine = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (currentChunk.length + line.length > maxChunkSize) {
        chunks.push({
          code_content: currentChunk.trim(),
          node_type: 'text_block',
          node_name: `block_lines_${startLine}_${i}`,
          start_line: startLine,
          end_line: i,
        });

        // Calculate overlap
        const overlapLines = [];
        let overlapLength = 0;
        let j = i - 1;
        while (j >= 0 && overlapLength < overlap) {
          overlapLines.unshift(lines[j]);
          overlapLength += lines[j].length;
          j--;
        }

        currentChunk = overlapLines.join('\n') + (overlapLines.length > 0 ? '\n' : '') + line + '\n';
        startLine = j + 2;
      } else {
        currentChunk += line + '\n';
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push({
        code_content: currentChunk.trim(),
        node_type: 'text_block',
        node_name: `block_lines_${startLine}_${lines.length}`,
        start_line: startLine,
        end_line: lines.length,
      });
    }

    return chunks;
  }

  /**
   * Traverse AST and extract semantic chunks (functions, classes)
   */
  static async chunkFile(filePath: string, content: string): Promise<Chunk[]> {
    await this.init();

    const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
    const language = await this.getLanguage(ext);

    if (!language) {
      // Fallback to recursive character splitting
      return this.fallbackChunking(content);
    }

    this.parserInstance.setLanguage(language);

    let tree;
    try {
      tree = this.parserInstance.parse(content);
    } catch (err) {
      console.warn(`AST Parsing failed for ${filePath}, falling back...`, err);
      return this.fallbackChunking(content);
    }

    const chunks: Chunk[] = [];

    // Simple AST traversal to find function and class declarations
    const traverse = (node: any) => {
      const type = node.type;

      // Node types to extract as chunks
      const chunkTypes = [
        'function_declaration',
        'class_declaration',
        'method_definition',
        'arrow_function',
        'export_statement',
        'function_definition',
        'function_expression',
        'function',
        'generator_function'
      ];

      if (chunkTypes.includes(type) && node.text.length > 50) {
        let name = 'anonymous';
        // Attempt to find the name of the function/class
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child.type === 'identifier' || child.type === 'property_identifier') {
            name = child.text;
            break;
          }
        }

        chunks.push({
          code_content: node.text,
          node_type: type,
          node_name: name,
          start_line: node.startPosition.row + 1,
          end_line: node.endPosition.row + 1,
        });
      } else {
        // Continue traversing if it's not a terminal block we want, or if we want to dive deeper?
        // Usually, if we chunk a class, we might also want its methods. 
        // For MVP, extracting top-level and distinct blocks is okay, but overlapping chunks might occur.
        // We will just traverse all children.
        for (let i = 0; i < node.childCount; i++) {
          traverse(node.child(i));
        }
      }
    };

    traverse(tree.rootNode);

    // If the file is very small or AST found nothing, chunk the whole file
    if (chunks.length === 0) {
      chunks.push({
        code_content: content.trim(),
        node_type: 'file',
        node_name: path.basename(filePath),
        start_line: 1,
        end_line: content.split('\n').length,
      });
    }

    return chunks;
  }
}
