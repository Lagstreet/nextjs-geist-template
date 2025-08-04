import { ProjectAnalysis, AIReport, SecurityIssue } from '@/types';

interface AIAnalysisOptions {
  prompt?: string;
  focus?: ('architecture' | 'quality' | 'security' | 'performance')[];
  userContext?: string;
}

export class LocalAIAnalyzer {
  async generateReport(
    projectAnalysis: ProjectAnalysis,
    options: AIAnalysisOptions
  ): Promise<AIReport> {
    const { prompt, focus = ['architecture', 'quality'], userContext } = options;

    // Analyse locale sans IA externe
    const report: AIReport = {
      id: `ai-${projectAnalysis.id}-${Date.now()}`,
      generatedAt: new Date().toISOString(),
      summary: this.generateSummary(projectAnalysis, userContext),
      architecture: this.analyzeArchitecture(projectAnalysis),
      codeQuality: this.analyzeCodeQuality(projectAnalysis),
      security: this.analyzeSecurity(projectAnalysis),
      performance: this.analyzePerformance(projectAnalysis),
<ask_followup_question>
<question>To proceed with installing the necessary dependencies and fixing the TypeScript errors related to missing modules and type declarations, may I run `npm install` in the backend directory to install all required packages including types for express, multer, babel, and others?</question>
</ask_followup_question>
