import express from 'express';
import path from 'path';
import fs from 'fs';
import { ProjectAnalysis } from '@/types';

const router = express.Router();

// GET /api/project - Liste tous les projets
router.get('/', (req: express.Request, res: express.Response) => {
  try {
    const projectsDir = path.join(__dirname, '../../projects');
    const analysesDir = path.join(__dirname, '../../analyses');

    if (!fs.existsSync(projectsDir)) {
      return res.json({
        success: true,
        projects: []
      });
    }

    const projects = fs.readdirSync(projectsDir)
      .filter(projectId => {
        const projectPath = path.join(projectsDir, projectId);
        return fs.statSync(projectPath).isDirectory();
      })
      .map(projectId => {
        const projectPath = path.join(projectsDir, projectId);
        const analysisPath = path.join(analysesDir, `${projectId}.json`);
        
        const stats = fs.statSync(projectPath);
        const analysisExists = fs.existsSync(analysisPath);
        
        let analysis: ProjectAnalysis | null = null;
        if (analysisExists) {
          try {
            analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf-8'));
          } catch (error) {
            console.error(`Erreur lecture analyse ${projectId}:`, error);
          }
        }

        return {
          id: projectId,
          name: analysis?.name || projectId,
          uploadedAt: stats.birthtime.toISOString(),
          lastModified: stats.mtime.toISOString(),
          status: analysis?.status || 'uploaded',
          filesCount: analysis?.files?.length || 0,
          errorsCount: analysis?.errors?.length || 0,
          hasAnalysis: analysisExists,
          metrics: analysis?.metrics || null
        };
      })
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

    res.json({
      success: true,
      projects
    });

  } catch (error) {
    console.error('Erreur récupération projets:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des projets'
    });
  }
});

// GET /api/project/:projectId - Détails d'un projet
router.get('/:projectId', (req: express.Request, res: express.Response) => {
  try {
    const { projectId } = req.params;
    const projectPath = path.join(__dirname, '../../projects', projectId);
    const analysisPath = path.join(__dirname, '../../analyses', `${projectId}.json`);

    if (!fs.existsSync(projectPath)) {
      return res.status(404).json({
        success: false,
        message: 'Projet non trouvé'
      });
    }

    const stats = fs.statSync(projectPath);
    const analysisExists = fs.existsSync(analysisPath);
    
    let analysis: ProjectAnalysis | null = null;
    if (analysisExists) {
      try {
        analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf-8'));
      } catch (error) {
        console.error(`Erreur lecture analyse ${projectId}:`, error);
      }
    }

    // Compter les fichiers
    const countFiles = (dir: string): number => {
      let count = 0;
      try {
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
          const itemPath = path.join(dir, item);
          const stat = fs.statSync(itemPath);
          
          if (stat.isDirectory() && !shouldIgnoreDirectory(item)) {
            count += countFiles(itemPath);
          } else if (stat.isFile() && !shouldIgnoreFile(item)) {
            count++;
          }
        }
      } catch (error) {
        console.error(`Erreur comptage fichiers ${dir}:`, error);
      }
      return count;
    };

    const totalFiles = countFiles(projectPath);

    const projectDetails = {
      id: projectId,
      name: analysis?.name || projectId,
      uploadedAt: stats.birthtime.toISOString(),
      lastModified: stats.mtime.toISOString(),
      status: analysis?.status || 'uploaded',
      totalFiles,
      analysis: analysis,
      fileTree: generateFileTree(projectPath)
    };

    res.json({
      success: true,
      project: projectDetails
    });

  } catch (error) {
    console.error('Erreur récupération projet:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du projet'
    });
  }
});

// DELETE /api/project/:projectId - Supprimer un projet
router.delete('/:projectId', (req: express.Request, res: express.Response) => {
  try {
    const { projectId } = req.params;
    const projectPath = path.join(__dirname, '../../projects', projectId);
    const analysisPath = path.join(__dirname, '../../analyses', `${projectId}.json`);

    // Supprimer le dossier du projet
    if (fs.existsSync(projectPath)) {
      fs.rmSync(projectPath, { recursive: true, force: true });
    }

    // Supprimer l'analyse
    if (fs.existsSync(analysisPath)) {
      fs.unlinkSync(analysisPath);
    }

    res.json({
      success: true,
      message: 'Projet supprimé avec succès'
    });

  } catch (error) {
    console.error('Erreur suppression projet:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du projet'
    });
  }
});

// GET /api/project/:projectId/files - Liste des fichiers d'un projet
router.get('/:projectId/files', (req: express.Request, res: express.Response) => {
  try {
    const { projectId } = req.params;
    const projectPath = path.join(__dirname, '../../projects', projectId);

    if (!fs.existsSync(projectPath)) {
      return res.status(404).json({
        success: false,
        message: 'Projet non trouvé'
      });
    }

    const files = getProjectFiles(projectPath);
    const fileDetails = files.map(filePath => {
      const relativePath = path.relative(projectPath, filePath);
      const stats = fs.statSync(filePath);
      
      return {
        path: relativePath,
        name: path.basename(filePath),
        size: stats.size,
        extension: path.extname(filePath),
        modified: stats.mtime
      };
    });

    res.json({
      success: true,
      files: fileDetails
    });

  } catch (error) {
    console.error('Erreur récupération fichiers:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des fichiers'
    });
  }
});

// GET /api/project/:projectId/file/:filePath - Contenu d'un fichier
router.get('/:projectId/file/*', (req: express.Request, res: express.Response) => {
  try {
    const { projectId } = req.params;
    const filePath = req.params[0] || '';
    
    const projectPath = path.join(__dirname, '../../projects', projectId);
    const fullFilePath = path.join(projectPath, filePath);

    // Sécurité: vérifier que le fichier est dans le projet
    if (!fullFilePath.startsWith(projectPath)) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé'
      });
    }

    if (!fs.existsSync(fullFilePath)) {
      return res.status(404).json({
        success: false,
        message: 'Fichier non trouvé'
      });
    }

    const stats = fs.statSync(fullFilePath);
    if (!stats.isFile()) {
      return res.status(400).json({
        success: false,
        message: 'Ce n\'est pas un fichier'
      });
    }

    const content = fs.readFileSync(fullFilePath, 'utf-8');
    const extension = path.extname(fullFilePath);
    
    res.json({
      success: true,
      file: {
        path: filePath,
        name: path.basename(filePath),
        content,
        extension,
        size: stats.size,
        modified: stats.mtime
      }
    });

  } catch (error) {
    console.error('Erreur récupération fichier:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du fichier'
    });
  }
});

// Fonctions utilitaires
function shouldIgnoreDirectory(dirName: string): boolean {
  const ignored = ['node_modules', '.git', '.vscode', '.idea', 'dist', 'build', 'coverage', '__pycache__'];
  return ignored.includes(dirName);
}

function shouldIgnoreFile(fileName: string): boolean {
  const ignored = ['.DS_Store', '.gitignore', '.env', '.env.local', '*.log', '*.tmp'];
  return ignored.some(pattern => {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace('*', '.*'));
      return regex.test(fileName);
    }
    return fileName === pattern;
  });
}

function getProjectFiles(projectPath: string): string[] {
  const files: string[] = [];

  function scanDirectory(dir: string) {
    try {
      const items = fs.readdirSync(dir);

      for (const item of items) {
        const itemPath = path.join(dir, item);
        const relativePath = path.relative(projectPath, itemPath);

        if (shouldIgnoreDirectory(item) || shouldIgnoreFile(item)) {
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

function generateFileTree(projectPath: string) {
  const tree: any = {};

  function buildTree(dir: string, current: any) {
    try {
      const items = fs.readdirSync(dir);

      for (const item of items) {
        const itemPath = path.join(dir, item);
        const relativePath = path.relative(projectPath, itemPath);

        if (shouldIgnoreDirectory(item) || shouldIgnoreFile(item)) {
          continue;
        }

        const stat = fs.statSync(itemPath);

        if (stat.isDirectory()) {
          current[item] = {};
          buildTree(itemPath, current[item]);
        } else {
          current[item] = {
            type: 'file',
            size: stat.size,
            modified: stat.mtime
          };
        }
      }
    } catch (error) {
      console.error(`Erreur construction arbre ${dir}:`, error);
    }
  }

  buildTree(projectPath, tree);
  return tree;
}

export { router as projectRouter };
