import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { extractZipFile } from '../services/fileExtractor';
import { UploadResponse } from '@/types';

const router = express.Router();

// Configuration Multer pour l'upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const projectId = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, `${projectId}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.zip', '.tar', '.gz', '.rar'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non supporté. Utilisez ZIP, TAR, GZ ou RAR.'));
    }
  }
});

// POST /api/upload - Upload d'un projet ZIP
router.post('/', upload.single('project'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier fourni'
      });
    }

    const projectId = path.basename(req.file.filename, path.extname(req.file.filename));
    const extractPath = path.join(__dirname, '../../projects', projectId);

    // Extraction du fichier
    const extractionResult = await extractZipFile(req.file.path, extractPath);
    
    if (!extractionResult.success) {
      return res.status(400).json({
        success: false,
        message: extractionResult.error || 'Erreur lors de l\'extraction'
      });
    }

    // Nettoyage du fichier ZIP temporaire
    fs.unlinkSync(req.file.path);

    const response: UploadResponse = {
      success: true,
      projectId,
      message: 'Projet uploadé et extrait avec succès',
      filesCount: extractionResult.filesCount
    };

    res.json(response);

  } catch (error) {
    console.error('Erreur upload:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne lors de l\'upload'
    });
  }
});

// GET /api/upload/status/:projectId - Statut d'un projet
router.get('/status/:projectId', (req, res) => {
  const { projectId } = req.params;
  const projectPath = path.join(__dirname, '../../projects', projectId);

  if (!fs.existsSync(projectPath)) {
    return res.status(404).json({
      success: false,
      message: 'Projet non trouvé'
    });
  }

  // Compter les fichiers
  const countFiles = (dir: string): number => {
    let count = 0;
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        count += countFiles(itemPath);
      } else {
        count++;
      }
    }
    
    return count;
  };

  const filesCount = countFiles(projectPath);

  res.json({
    success: true,
    projectId,
    status: 'extracted',
    filesCount,
    extractedAt: fs.statSync(projectPath).mtime
  });
});

// DELETE /api/upload/:projectId - Supprimer un projet
router.delete('/:projectId', (req, res) => {
  const { projectId } = req.params;
  const projectPath = path.join(__dirname, '../../projects', projectId);

  if (!fs.existsSync(projectPath)) {
    return res.status(404).json({
      success: false,
      message: 'Projet non trouvé'
    });
  }

  try {
    // Suppression récursive du dossier
    fs.rmSync(projectPath, { recursive: true, force: true });

    res.json({
      success: true,
      message: 'Projet supprimé avec succès'
    });

  } catch (error) {
    console.error('Erreur suppression:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression'
    });
  }
});

export { router as uploadRouter };
