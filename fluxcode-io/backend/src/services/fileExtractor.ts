import fs from 'fs';
import path from 'path';
import yauzl from 'yauzl';
import { promisify } from 'util';

interface ExtractionResult {
  success: boolean;
  filesCount?: number;
  error?: string;
}

export async function extractZipFile(zipPath: string, extractPath: string): Promise<ExtractionResult> {
  return new Promise((resolve) => {
    // Créer le dossier de destination
    if (!fs.existsSync(extractPath)) {
      fs.mkdirSync(extractPath, { recursive: true });
    }

    let filesCount = 0;

    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) {
        return resolve({
          success: false,
          error: `Erreur lors de l'ouverture du ZIP: ${err.message}`
        });
      }

      if (!zipfile) {
        return resolve({
          success: false,
          error: 'Fichier ZIP invalide'
        });
      }

      zipfile.readEntry();

      zipfile.on('entry', (entry) => {
        const fileName = entry.fileName;
        const fullPath = path.join(extractPath, fileName);

        // Ignorer les dossiers système et node_modules
        if (shouldIgnoreFile(fileName)) {
          zipfile.readEntry();
          return;
        }

        // Si c'est un dossier
        if (/\/$/.test(fileName)) {
          fs.mkdirSync(fullPath, { recursive: true });
          zipfile.readEntry();
          return;
        }

        // Créer le dossier parent si nécessaire
        const dirName = path.dirname(fullPath);
        if (!fs.existsSync(dirName)) {
          fs.mkdirSync(dirName, { recursive: true });
        }

        // Extraire le fichier
        zipfile.openReadStream(entry, (err, readStream) => {
          if (err) {
            console.error(`Erreur lecture ${fileName}:`, err);
            zipfile.readEntry();
            return;
          }

          if (!readStream) {
            zipfile.readEntry();
            return;
          }

          const writeStream = fs.createWriteStream(fullPath);
          
          readStream.on('end', () => {
            filesCount++;
            zipfile.readEntry();
          });

          readStream.on('error', (err) => {
            console.error(`Erreur extraction ${fileName}:`, err);
            zipfile.readEntry();
          });

          readStream.pipe(writeStream);
        });
      });

      zipfile.on('end', () => {
        resolve({
          success: true,
          filesCount
        });
      });

      zipfile.on('error', (err) => {
        resolve({
          success: false,
          error: `Erreur lors de l'extraction: ${err.message}`
        });
      });
    });
  });
}

function shouldIgnoreFile(fileName: string): boolean {
  const ignoredPatterns = [
    /^__MACOSX\//,
    /\.DS_Store$/,
    /^\.git\//,
    /^node_modules\//,
    /^\.vscode\//,
    /^\.idea\//,
    /^dist\//,
    /^build\//,
    /^coverage\//,
    /\.log$/,
    /\.tmp$/,
    /\.cache$/
  ];

  return ignoredPatterns.some(pattern => pattern.test(fileName));
}

export function getProjectFiles(projectPath: string): string[] {
  const files: string[] = [];

  function scanDirectory(dir: string) {
    try {
      const items = fs.readdirSync(dir);

      for (const item of items) {
        const itemPath = path.join(dir, item);
        const relativePath = path.relative(projectPath, itemPath);

        if (shouldIgnoreFile(relativePath)) {
          continue;
        }

        const stat = fs.statSync(itemPath);

        if (stat.isDirectory()) {
          scanDirectory(itemPath);
        } else if (stat.isFile()) {
          files.push(itemPath);
        }
      }
    } catch (error) {
      console.error(`Erreur lecture dossier ${dir}:`, error);
    }
  }

  scanDirectory(projectPath);
  return files;
}

export function getFileInfo(filePath: string) {
  try {
    const stat = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    
    return {
      name: path.basename(filePath),
      path: filePath,
      extension: ext,
      size: stat.size,
      modified: stat.mtime,
      isText: isTextFile(ext),
      language: getLanguageFromExtension(ext)
    };
  } catch (error) {
    console.error(`Erreur info fichier ${filePath}:`, error);
    return null;
  }
}

function isTextFile(extension: string): boolean {
  const textExtensions = [
    '.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte',
    '.html', '.htm', '.css', '.scss', '.sass', '.less',
    '.json', '.xml', '.yaml', '.yml', '.toml',
    '.md', '.txt', '.py', '.php', '.rb', '.go',
    '.java', '.c', '.cpp', '.h', '.hpp',
    '.sh', '.bash', '.zsh', '.fish',
    '.sql', '.graphql', '.gql'
  ];

  return textExtensions.includes(extension);
}

function getLanguageFromExtension(extension: string): string {
  const languageMap: { [key: string]: string } = {
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.vue': 'vue',
    '.svelte': 'svelte',
    '.html': 'html',
    '.htm': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.sass': 'sass',
    '.less': 'less',
    '.json': 'json',
    '.xml': 'xml',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.md': 'markdown',
    '.py': 'python',
    '.php': 'php',
    '.rb': 'ruby',
    '.go': 'go',
    '.java': 'java',
    '.c': 'c',
    '.cpp': 'cpp',
    '.sql': 'sql'
  };

  return languageMap[extension] || 'text';
}
