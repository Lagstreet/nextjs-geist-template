import express from 'express';
import path from 'path';
import fs from 'fs';
import { AIAnalysisRequest, AIReport, ProjectAnalysis } from '@/types';
import { LocalAIAnalyzer } from '../services/localAI';

const router = express.Router();

// POST /api/ai/analyze - Générer un rapport IA
router.post('/analyze', async (req: express.Request, res: express.Response) => {
  try {
    const { projectId, prompt, focus = ['architecture', 'quality'], userContext }: AIAnalysisRequest = req.body;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: 'ID de projet requis'
      });
    }

    // Récupérer l'analyse existante
    const analysisPath = path.join(__dirname, '../../analyses', `${projectId}.json`);
    
    if (!fs.existsSync(analysisPath)) {
      return res.status(404).json({
        success: false,
        message: 'Analyse de projet non trouvée. Lancez d\'abord l\'analyse du code.'
      });
    }

    const projectAnalysis: ProjectAnalysis = JSON.parse(fs.readFileSync(analysisPath, 'utf-8'));

    // Utiliser l'IA locale pour générer le rapport
    const localAI = new LocalAIAnalyzer();
    const aiReport = await localAI.generateReport(projectAnalysis, {
      prompt,
      focus,
      userContext
    });

    // Mettre à jour l'analyse avec le rapport IA
    projectAnalysis.aiReport = aiReport;
    fs.writeFileSync(analysisPath, JSON.stringify(projectAnalysis, null, 2));

    res.json({
      success: true,
      report: aiReport
    });

  } catch (error) {
    console.error('Erreur génération rapport IA:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération du rapport IA',
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
});

// GET /api/ai/prompts - Récupérer les prompts disponibles
router.get('/prompts', (req: express.Request, res: express.Response) => {
  try {
    const promptsPath = path.join(__dirname, '../prompts/templates.json');
    
    if (!fs.existsSync(promptsPath)) {
      // Créer les prompts par défaut
      const defaultPrompts = {
        architecture: {
          title: "Analyse d'architecture",
          description: "Analyse la structure et l'organisation du code",
          template: "Analysez l'architecture de ce projet {language}. Identifiez les forces, faiblesses et suggestions d'amélioration."
        },
        quality: {
          title: "Qualité du code",
          description: "Évalue la qualité, lisibilité et maintenabilité",
          template: "Évaluez la qualité de ce code {language}. Analysez la lisibilité, les bonnes pratiques et la maintenabilité."
        },
        security: {
          title: "Analyse de sécurité",
          description: "Détecte les vulnérabilités et problèmes de sécurité",
          template: "Analysez ce projet {language} pour identifier les vulnérabilités de sécurité et recommandations."
        },
        performance: {
          title: "Optimisation performance",
          description: "Identifie les goulots d'étranglement et optimisations",
          template: "Analysez les performances de ce projet {language}. Identifiez les goulots d'étranglement et optimisations possibles."
        },
        beginner: {
          title: "Guide débutant",
          description: "Explications pédagogiques pour débutants",
          template: "Expliquez ce projet {language} de manière pédagogique pour un débutant. Décrivez le flux, les concepts clés et les bonnes pratiques."
        },
        refactoring: {
          title: "Suggestions de refactoring",
          description: "Propose des améliorations structurelles",
          template: "Proposez des suggestions de refactoring pour ce projet {language}. Identifiez le code dupliqué, les améliorations possibles."
        }
      };

      const promptsDir = path.dirname(promptsPath);
      if (!fs.existsSync(promptsDir)) {
        fs.mkdirSync(promptsDir, { recursive: true });
      }
      
      fs.writeFileSync(promptsPath, JSON.stringify(defaultPrompts, null, 2));
    }

    const prompts = JSON.parse(fs.readFileSync(promptsPath, 'utf-8'));

    res.json({
      success: true,
      prompts
    });

  } catch (error) {
    console.error('Erreur récupération prompts:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des prompts'
    });
  }
});

// POST /api/ai/prompts - Sauvegarder un prompt personnalisé
router.post('/prompts', (req: express.Request, res: express.Response) => {
  try {
    const { id, title, description, template } = req.body;

    if (!id || !title || !template) {
      return res.status(400).json({
        success: false,
        message: 'ID, titre et template requis'
      });
    }

    const promptsPath = path.join(__dirname, '../prompts/templates.json');
    let prompts = {};

    if (fs.existsSync(promptsPath)) {
      prompts = JSON.parse(fs.readFileSync(promptsPath, 'utf-8'));
    }

    (prompts as any)[id] = {
      title,
      description: description || '',
      template,
      custom: true,
      createdAt: new Date().toISOString()
    };

    fs.writeFileSync(promptsPath, JSON.stringify(prompts, null, 2));

    res.json({
      success: true,
      message: 'Prompt sauvegardé avec succès'
    });

  } catch (error) {
    console.error('Erreur sauvegarde prompt:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la sauvegarde du prompt'
    });
  }
});

// GET /api/ai/report/:projectId - Récupérer le rapport IA d'un projet
router.get('/report/:projectId', (req: express.Request, res: express.Response) => {
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

    if (!analysis.aiReport) {
      return res.status(404).json({
        success: false,
        message: 'Rapport IA non généré pour ce projet'
      });
    }

    res.json({
      success: true,
      report: analysis.aiReport
    });

  } catch (error) {
    console.error('Erreur récupération rapport IA:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du rapport IA'
    });
  }
});

// POST /api/ai/export/:projectId - Exporter le rapport en PDF/Markdown
router.post('/export/:projectId', (req: express.Request, res: express.Response) => {
  try {
    const { projectId } = req.params;
    const { format = 'markdown' } = req.body;

    const analysisPath = path.join(__dirname, '../../analyses', `${projectId}.json`);

    if (!fs.existsSync(analysisPath)) {
      return res.status(404).json({
        success: false,
        message: 'Analyse non trouvée'
      });
    }

    const analysis: ProjectAnalysis = JSON.parse(fs.readFileSync(analysisPath, 'utf-8'));

    if (!analysis.aiReport) {
      return res.status(404).json({
        success: false,
        message: 'Rapport IA non généré pour ce projet'
      });
    }

    // Générer le contenu exporté
    const exportContent = generateExportContent(analysis, format);
    const fileName = `${projectId}-report.${format === 'pdf' ? 'pdf' : 'md'}`;
    const exportPath = path.join(__dirname, '../../exports', fileName);

    // Créer le dossier d'export
    const exportDir = path.dirname(exportPath);
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    fs.writeFileSync(exportPath, exportContent);

    res.json({
      success: true,
      message: 'Rapport exporté avec succès',
      downloadUrl: `/exports/${fileName}`,
      fileName
    });

  } catch (error) {
    console.error('Erreur export rapport:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'export du rapport'
    });
  }
});

function generateExportContent(analysis: ProjectAnalysis, format: string): string {
  const { aiReport, metrics, errors, suggestions } = analysis;

  if (!aiReport) return '';

  if (format === 'markdown') {
    return `# Rapport d'analyse - ${analysis.name}

## Résumé
${aiReport.summary}

## Architecture
### Vue d'ensemble
${aiReport.architecture.overview}

### Forces
${aiReport.architecture.strengths.map(s => `- ${s}`).join('\n')}

### Faiblesses
${aiReport.architecture.weaknesses.map(w => `- ${w}`).join('\n')}

### Suggestions
${aiReport.architecture.suggestions.map(s => `- ${s}`).join('\n')}

## Qualité du code
**Score:** ${aiReport.codeQuality.score}/100

### Problèmes identifiés
${aiReport.codeQuality.issues.map(i => `- ${i}`).join('\n')}

### Améliorations suggérées
${aiReport.codeQuality.improvements.map(i => `- ${i}`).join('\n')}

## Sécurité
### Vulnérabilités
${aiReport.security.vulnerabilities.map(v => `- **${v.severity.toUpperCase()}**: ${v.description} (${v.file})`).join('\n')}

### Recommandations
${aiReport.security.recommendations.map(r => `- ${r}`).join('\n')}

## Performance
### Goulots d'étranglement
${aiReport.performance.bottlenecks.map(b => `- ${b}`).join('\n')}

### Optimisations
${aiReport.performance.optimizations.map(o => `- ${o}`).join('\n')}

## Maintenabilité
**Score:** ${aiReport.maintainability.score}/100

### Facteurs
${aiReport.maintainability.factors.map(f => `- ${f}`).join('\n')}

### Recommandations
${aiReport.maintainability.recommendations.map(r => `- ${r}`).join('\n')}

## Métriques
- **Complexité moyenne:** ${metrics.complexity.average.toFixed(2)}
- **Complexité maximale:** ${metrics.complexity.max}
- **Couverture fonctions:** ${metrics.coverage.functions.toFixed(1)}%
- **Dette technique:** ${metrics.technical_debt.hours.toFixed(1)} heures

## Erreurs (${errors.length})
${errors.slice(0, 10).map(e => `- **${e.severity.toUpperCase()}**: ${e.message} (${e.file}:${e.line})`).join('\n')}

## Suggestions (${suggestions.length})
${suggestions.slice(0, 10).map(s => `- **${s.priority.toUpperCase()}**: ${s.title} - ${s.description}`).join('\n')}

---
*Rapport généré le ${new Date().toLocaleDateString('fr-FR')} par FluxCode.io*
`;
  }

  // Format PDF (pour l'instant, retourner du HTML simple)
  return `<!DOCTYPE html>
<html>
<head>
  <title>Rapport d'analyse - ${analysis.name}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    h1, h2, h3 { color: #333; }
    .score { font-weight: bold; color: #007bff; }
    .severity-high { color: #dc3545; }
    .severity-medium { color: #ffc107; }
    .severity-low { color: #28a745; }
  </style>
</head>
<body>
  <h1>Rapport d'analyse - ${analysis.name}</h1>
  <h2>Résumé</h2>
  <p>${aiReport.summary}</p>
  <!-- Contenu HTML complet ici -->
</body>
</html>`;
}

export { router as aiRouter };
