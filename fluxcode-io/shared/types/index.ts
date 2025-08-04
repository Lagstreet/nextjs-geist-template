// Types partagés entre frontend et backend

export interface FileNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'directory';
  extension?: string;
  size: number;
  content?: string;
  language?: string;
  complexity?: number;
  errors: CodeError[];
  functions: FunctionInfo[];
  imports: ImportInfo[];
  exports: ExportInfo[];
}

export interface FunctionInfo {
  name: string;
  line: number;
  column: number;
  parameters: string[];
  returnType?: string;
  complexity: number;
  isUsed: boolean;
  calledBy: string[];
  calls: string[];
}

export interface ImportInfo {
  source: string;
  imports: string[];
  line: number;
  isResolved: boolean;
}

export interface ExportInfo {
  name: string;
  type: 'default' | 'named';
  line: number;
}

export interface Relationship {
  id: string;
  source: string;
  target: string;
  type: 'import' | 'function_call' | 'component_usage' | 'api_call';
  strength: number; // 0-1
  bidirectional: boolean;
}

export interface CodeError {
  id: string;
  type: 'unused_variable' | 'unused_function' | 'missing_import' | 'unreachable_code' | 'duplicate_code';
  severity: 'error' | 'warning' | 'info';
  message: string;
  file: string;
  line: number;
  column: number;
  suggestion?: string;
}

export interface Suggestion {
  id: string;
  type: 'refactor' | 'optimization' | 'best_practice' | 'security';
  title: string;
  description: string;
  file: string;
  line?: number;
  priority: 'high' | 'medium' | 'low';
  effort: 'easy' | 'medium' | 'hard';
}

export interface QualityMetrics {
  complexity: {
    average: number;
    max: number;
    distribution: { [key: string]: number };
  };
  duplication: {
    percentage: number;
    instances: number;
  };
  coverage: {
    functions: number;
    lines: number;
  };
  maintainability: number; // 0-100
  technical_debt: {
    hours: number;
    issues: number;
  };
}

export interface ProjectAnalysis {
  id: string;
  name: string;
  uploadedAt: string;
  analyzedAt: string;
  status: 'uploading' | 'analyzing' | 'completed' | 'error';
  files: FileNode[];
  relationships: Relationship[];
  errors: CodeError[];
  suggestions: Suggestion[];
  metrics: QualityMetrics;
  aiReport?: AIReport;
}

export interface AIReport {
  id: string;
  generatedAt: string;
  summary: string;
  architecture: {
    overview: string;
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
  };
  codeQuality: {
    score: number; // 0-100
    issues: string[];
    improvements: string[];
  };
  security: {
    vulnerabilities: SecurityIssue[];
    recommendations: string[];
  };
  performance: {
    bottlenecks: string[];
    optimizations: string[];
  };
  maintainability: {
    score: number; // 0-100
    factors: string[];
    recommendations: string[];
  };
}

export interface SecurityIssue {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  file: string;
  line?: number;
  solution: string;
}

export interface UploadResponse {
  success: boolean;
  projectId: string;
  message: string;
  filesCount?: number;
}

export interface AnalysisRequest {
  projectId: string;
  options?: {
    includeTests: boolean;
    includeNodeModules: boolean;
    maxFileSize: number;
    languages: string[];
  };
}

export interface AIAnalysisRequest {
  projectId: string;
  prompt?: string;
  focus?: ('architecture' | 'quality' | 'security' | 'performance')[];
  userContext?: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'file' | 'function' | 'component' | 'api';
  x: number;
  y: number;
  size: number;
  color: string;
  data: any;
  errors: number;
  complexity: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  weight: number;
  color: string;
  animated?: boolean;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  layout: 'force' | 'hierarchical' | 'circular';
  filters: {
    fileTypes: string[];
    errorLevels: string[];
    complexityRange: [number, number];
  };
}

// Utilitaires de type
export type ProjectStatus = ProjectAnalysis['status'];
export type ErrorSeverity = CodeError['severity'];
export type SuggestionType = Suggestion['type'];
export type RelationshipType = Relationship['type'];
