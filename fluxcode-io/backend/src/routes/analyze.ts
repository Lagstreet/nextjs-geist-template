import express from 'express';
import path from 'path';
import fs from 'fs';
import { CodeAnalyzer } from '../services/codeAnalyzer';
import { AnalysisRequest, ProjectAnalysis, QualityMetrics } from '@/types';

const router = express.Router();

// POST /api/analyze - Analyser un projet
router.post('/', async (req: express.Request, res: express.Response) => {
  try {
    const { projectId, options = {} }: AnalysisRequest = req.body;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: 'ID de projet requis'
      });
    }

    const projectPath = path.join(__dirname, '../../projects', projectId);

    if (!fs.existsSync(projectPath)) {
      return res.status(404).json({
        success: false,
        message: 'Projet non trouvé'
      });
    }

    // Initialiser l'analyseur
    const analyzer = new CodeAnalyzer(projectPath);
    
    // Lancer l'analyse
    const analysisResult = await analyzer.analyzeProject();

    // Calculer les métriques de qualité
    const metrics = calculateQualityMetrics(analysisResult);

    // Créer l'objet d'analyse complet
    const projectAnalysis: ProjectAnalysis = {
      id: projectId,
      name: path.basename(projectPath),
      uploadedAt: fs.statSync(projectPath).birthtime.toISOString(),
      analyzedAt: new Date().toISOString(),
      status: 'completed',
      files: analysisResult.files,
      relationships: analysisResult.relationships,
      errors: analysisResult.errors,
      suggestions: generateSuggestions(analysisResult),
      metrics
    };

    // Sauvegarder l'analyse
    const analysisPath = path.join(__dirname, '../../analyses', `${projectId}.json`);
    const analysisDir = path.dirname(analysisPath);
    
    if (!fs.existsSync(analysisDir)) {
      fs.mkdirSync(analysisDir, { recursive: true });
    }
    
    fs.writeFileSync(analysisPath, JSON.stringify(projectAnalysis, null, 2));

    res.json({
      success: true,
      analysis: projectAnalysis
    });

  } catch (error) {
    console.error('Erreur analyse:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'analyse',
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
});

// GET /api/analyze/:projectId - Récupérer une analyse existante
router.get('/:projectId', (req: express.Request, res: express.Response) => {
  try {
    const { projectId } = req.params;
    const analysisPath = path.join(__dirname, '../../analyses', `${projectId}.json`);

    if (!fs.existsSync(analysisPath)) {
      return res.status(404).json({
        success: false,
        message: 'Analyse non trouvée'
      });
    }

    const analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf-8'));

    res.json({
      success: true,
      analysis
    });

  } catch (error) {
    console.error('Erreur récupération analyse:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'analyse'
    });
  }
});

// GET /api/analyze/:projectId/graph - Données pour le graphe visuel
router.get('/:projectId/graph', (req: express.Request, res: express.Response) => {
  try {
    const { projectId } = req.params;
    const analysisPath = path.join(__dirname, '../../analyses', `${projectId}.json`);

    if (!fs.existsSync(analysisPath)) {
      return res.status(404).json({
        success: false,
        message: 'Analyse non trouvée'
      });
    }

    const analysis: ProjectAnalysis = JSON.parse(fs.readFileSync(analysisPath, 'utf-8'));

    // Convertir en format graphe
    const nodes = analysis.files.map(file => ({
      id: file.id,
      label: file.name,
      type: 'file',
      x: Math.random() * 800,
      y: Math.random() * 600,
      size: Math.max(10, Math.min(50, file.complexity * 2)),
      color: getNodeColor(file),
      data: {
        path: file.path,
        language: file.language,
        complexity: file.complexity,
        functions: file.functions.length,
        errors: file.errors.length
      },
      errors: file.errors.length,
      complexity: file.complexity
    }));

    const edges = analysis.relationships.map(rel => ({
      id: rel.id,
      source: rel.source,
      target: rel.target,
      type: rel.type,
      weight: rel.strength,
      color: getEdgeColor(rel.type),
      animated: rel.type === 'function_call'
    }));

    const graphData = {
      nodes,
      edges,
      layout: 'force',
      filters: {
        fileTypes: [...new Set(analysis.files.map(f => f.language || 'unknown'))],
        errorLevels: ['error', 'warning', 'info'],
        complexityRange: [0, Math.max(...analysis.files.map(f => f.complexity))]
      }
    };

    res.json({
      success: true,
      graph: graphData
    });

  } catch (error) {
    console.error('Erreur génération graphe:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération du graphe'
    });
  }
});

function calculateQualityMetrics(analysisResult: any): QualityMetrics {
  const { files, errors } = analysisResult;

  const complexities = files.map((f: any) => f.complexity);
  const totalFunctions = files.reduce((sum: number, f: any) => sum + f.functions.length, 0);
  const usedFunctions = files.reduce((sum: number, f: any) => 
    sum + f.functions.filter((func: any) => func.isUsed).length, 0);

  const errorCount = errors.filter((e: any) => e.severity === 'error').length;
  const warningCount = errors.filter((e: any) => e.severity === 'warning').length;

  return {
    complexity: {
      average: complexities.length > 0 ? complexities.reduce((a, b) => a + b, 0) / complexities.length : 0,
      max: Math.max(...complexities, 0),
      distribution: complexities.reduce((dist: any, c: number) => {
        const range = c < 5 ? 'low' : c < 15 ? 'medium' : 'high';
        dist[range] = (dist[range] || 0) + 1;
        return dist;
      }, {})
    },
    duplication: {
      percentage: 0, // À implémenter avec une analyse plus poussée
      instances: 0
    },
    coverage: {
      functions: totalFunctions > 0 ? (usedFunctions / totalFunctions) * 100 : 0,
      lines: 0 // À implémenter
    },
    maintainability: Math.max(0, 100 - (errorCount * 10) - (warningCount * 5) - (complexities.reduce((a, b) => a + b, 0) / 10)),
    technical_debt: {
      hours: errorCount * 0.5 + warningCount * 0.2,
      issues: errorCount + warningCount
    }
  };
}

function generateSuggestions(analysisResult: any) {
  const suggestions = [];
  const { files, errors } = analysisResult;

  // Suggestions basées sur la complexité
  const highComplexityFiles = files.filter((f: any) => f.complexity > 15);
  for (const file of highComplexityFiles) {
    suggestions.push({
      id: `refactor-${file.id}`,
      type: 'refactor',
      title: 'Réduire la complexité',
      description: `Le fichier ${file.name} a une complexité de ${file.complexity}. Considérez le diviser en plus petites fonctions.`,
      file: file.path,
      priority: file.complexity > 25 ? 'high' : 'medium',
      effort: 'medium'
    });
  }

  // Suggestions basées sur les erreurs
  const errorFiles = files.filter((f: any) => f.errors.length > 0);
  for (const file of errorFiles) {
    suggestions.push({
      id: `fix-errors-${file.id}`,
      type: 'best_practice',
      title: 'Corriger les erreurs',
      description: `Le fichier ${file.name} contient ${file.errors.length} erreur(s).`,
      file: file.path,
      priority: 'high',
      effort: 'easy'
    });
  }

  return suggestions;
}

function getNodeColor(file: any): string {
  if (file.errors.length > 0) return '#ef4444'; // Rouge pour erreurs
  if (file.complexity > 20) return '#f59e0b'; // Orange pour complexité élevée
  if (file.complexity > 10) return '#eab308'; // Jaune pour complexité moyenne
  return '#10b981'; // Vert pour fichiers sains
}

function getEdgeColor(type: string): string {
  switch (type) {
    case 'import': return '#6366f1';
    case 'function_call': return '#8b5cf6';
    case 'component_usage': return '#06b6d4';
    case 'api_call': return '#f59e0b';
    default: return '#6b7280';
  }
}

export { router as analyzeRouter };
