import fs from 'fs';
import path from 'path';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { FileNode, FunctionInfo, ImportInfo, ExportInfo, CodeError, Relationship } from '@/types';
import { getProjectFiles, getFileInfo } from './fileExtractor';

export class CodeAnalyzer {
  private projectPath: string;
  private files: FileNode[] = [];
  private relationships: Relationship[] = [];
  private errors: CodeError[] = [];

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  async analyzeProject(): Promise<{
    files: FileNode[];
    relationships: Relationship[];
    errors: CodeError[];
  }> {
    const filePaths = getProjectFiles(this.projectPath);
    
    // Analyser chaque fichier
    for (const filePath of filePaths) {
      const fileInfo = getFileInfo(filePath);
      if (!fileInfo || !fileInfo.isText) continue;

      const fileNode = await this.analyzeFile(filePath, fileInfo);
      if (fileNode) {
        this.files.push(fileNode);
      }
    }

    // Analyser les relations entre fichiers
    this.analyzeRelationships();

    // Détecter les erreurs
    this.detectErrors();

    return {
      files: this.files,
      relationships: this.relationships,
      errors: this.errors
    };
  }

  private async analyzeFile(filePath: string, fileInfo: any): Promise<FileNode | null> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const relativePath = path.relative(this.projectPath, filePath);

      const fileNode: FileNode = {
        id: relativePath,
        name: fileInfo.name,
        path: relativePath,
        type: 'file',
        extension: fileInfo.extension,
        size: fileInfo.size,
        content,
        language: fileInfo.language,
        complexity: 0,
        errors: [],
        functions: [],
        imports: [],
        exports: []
      };

      // Analyser le code JavaScript/TypeScript
      if (this.isJavaScriptFile(fileInfo.extension)) {
        await this.analyzeJavaScriptFile(fileNode, content);
      }

      return fileNode;

    } catch (error) {
      console.error(`Erreur analyse fichier ${filePath}:`, error);
      return null;
    }
  }

  private async analyzeJavaScriptFile(fileNode: FileNode, content: string) {
    try {
      const ast = parse(content, {
        sourceType: 'module',
        allowImportExportEverywhere: true,
        allowReturnOutsideFunction: true,
        plugins: [
          'jsx',
          'typescript',
          'decorators-legacy',
          'classProperties',
          'objectRestSpread',
          'asyncGenerators',
          'functionBind',
          'exportDefaultFrom',
          'exportNamespaceFrom',
          'dynamicImport',
          'nullishCoalescingOperator',
          'optionalChaining'
        ]
      });

      let complexity = 0;

      traverse(ast, {
        // Analyser les imports
        ImportDeclaration: (path) => {
          const importInfo: ImportInfo = {
            source: path.node.source.value,
            imports: path.node.specifiers.map(spec => {
              if (t.isImportDefaultSpecifier(spec)) {
                return spec.local.name;
              } else if (t.isImportSpecifier(spec)) {
                return spec.imported.type === 'Identifier' ? spec.imported.name : spec.imported.value;
              } else if (t.isImportNamespaceSpecifier(spec)) {
                return `* as ${spec.local.name}`;
              }
              return '';
            }).filter(Boolean),
            line: path.node.loc?.start.line || 0,
            isResolved: this.isImportResolved(path.node.source.value, fileNode.path)
          };
          fileNode.imports.push(importInfo);
        },

        // Analyser les exports
        ExportNamedDeclaration: (path) => {
          if (path.node.declaration) {
            if (t.isFunctionDeclaration(path.node.declaration) && path.node.declaration.id) {
              fileNode.exports.push({
                name: path.node.declaration.id.name,
                type: 'named',
                line: path.node.loc?.start.line || 0
              });
            } else if (t.isVariableDeclaration(path.node.declaration)) {
              path.node.declaration.declarations.forEach(decl => {
                if (t.isIdentifier(decl.id)) {
                  fileNode.exports.push({
                    name: decl.id.name,
                    type: 'named',
                    line: path.node.loc?.start.line || 0
                  });
                }
              });
            }
          }
        },

        ExportDefaultDeclaration: (path) => {
          let name = 'default';
          if (t.isFunctionDeclaration(path.node.declaration) && path.node.declaration.id) {
            name = path.node.declaration.id.name;
          } else if (t.isIdentifier(path.node.declaration)) {
            name = path.node.declaration.name;
          }
          
          fileNode.exports.push({
            name,
            type: 'default',
            line: path.node.loc?.start.line || 0
          });
        },

        // Analyser les fonctions
        FunctionDeclaration: (path) => {
          if (path.node.id) {
            const functionInfo: FunctionInfo = {
              name: path.node.id.name,
              line: path.node.loc?.start.line || 0,
              column: path.node.loc?.start.column || 0,
              parameters: path.node.params.map(param => {
                if (t.isIdentifier(param)) return param.name;
                return 'unknown';
              }),
              complexity: this.calculateFunctionComplexity(path),
              isUsed: false,
              calledBy: [],
              calls: []
            };
            fileNode.functions.push(functionInfo);
            complexity += functionInfo.complexity;
          }
        },

        ArrowFunctionExpression: (path) => {
          const parent = path.parent;
          let name = 'anonymous';
          
          if (t.isVariableDeclarator(parent) && t.isIdentifier(parent.id)) {
            name = parent.id.name;
          } else if (t.isAssignmentExpression(parent) && t.isIdentifier(parent.left)) {
            name = parent.left.name;
          }

          const functionInfo: FunctionInfo = {
            name,
            line: path.node.loc?.start.line || 0,
            column: path.node.loc?.start.column || 0,
            parameters: path.node.params.map(param => {
              if (t.isIdentifier(param)) return param.name;
              return 'unknown';
            }),
            complexity: this.calculateFunctionComplexity(path),
            isUsed: false,
            calledBy: [],
            calls: []
          };
          fileNode.functions.push(functionInfo);
          complexity += functionInfo.complexity;
        },

        // Calculer la complexité
        IfStatement: () => complexity++,
        WhileStatement: () => complexity++,
        ForStatement: () => complexity++,
        ForInStatement: () => complexity++,
        ForOfStatement: () => complexity++,
        SwitchCase: () => complexity++,
        CatchClause: () => complexity++,
        ConditionalExpression: () => complexity++,
        LogicalExpression: (path) => {
          if (path.node.operator === '&&' || path.node.operator === '||') {
            complexity++;
          }
        }
      });

      fileNode.complexity = complexity;

    } catch (error) {
      console.error(`Erreur parsing AST pour ${fileNode.path}:`, error);
      
      // Ajouter une erreur de parsing
      this.errors.push({
        id: `parse-error-${fileNode.id}`,
        type: 'missing_import',
        severity: 'error',
        message: `Erreur de parsing: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
        file: fileNode.path,
        line: 1,
        column: 1,
        suggestion: 'Vérifiez la syntaxe du fichier'
      });
    }
  }

  private calculateFunctionComplexity(path: any): number {
    let complexity = 1; // Base complexity

    path.traverse({
      IfStatement: () => complexity++,
      WhileStatement: () => complexity++,
      ForStatement: () => complexity++,
      ForInStatement: () => complexity++,
      ForOfStatement: () => complexity++,
      SwitchCase: () => complexity++,
      CatchClause: () => complexity++,
      ConditionalExpression: () => complexity++,
      LogicalExpression: (innerPath: any) => {
        if (innerPath.node.operator === '&&' || innerPath.node.operator === '||') {
          complexity++;
        }
      }
    });

    return complexity;
  }

  private isJavaScriptFile(extension: string): boolean {
    return ['.js', '.jsx', '.ts', '.tsx', '.vue'].includes(extension);
  }

  private isImportResolved(importPath: string, currentFile: string): boolean {
    // Import relatif
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      const resolvedPath = path.resolve(path.dirname(currentFile), importPath);
      const possibleExtensions = ['.js', '.jsx', '.ts', '.tsx', '.json'];
      
      for (const ext of possibleExtensions) {
        if (fs.existsSync(resolvedPath + ext)) {
          return true;
        }
      }
      
      // Vérifier si c'est un dossier avec index
      const indexPath = path.join(resolvedPath, 'index');
      for (const ext of possibleExtensions) {
        if (fs.existsSync(indexPath + ext)) {
          return true;
        }
      }
      
      return false;
    }

    // Import de node_modules (considéré comme résolu)
    return true;
  }

  private analyzeRelationships() {
    for (const file of this.files) {
      // Relations d'import
      for (const importInfo of file.imports) {
        const targetFile = this.resolveImportPath(importInfo.source, file.path);
        if (targetFile) {
          this.relationships.push({
            id: `import-${file.id}-${targetFile}`,
            source: file.id,
            target: targetFile,
            type: 'import',
            strength: 0.8,
            bidirectional: false
          });
        }
      }

      // Relations d'appel de fonction (analyse basique)
      for (const func of file.functions) {
        // Chercher les appels dans le contenu du fichier
        const content = file.content || '';
        const functionCallRegex = new RegExp(`\\b(\\w+)\\s*\\(`, 'g');
        let match;

        while ((match = functionCallRegex.exec(content)) !== null) {
          const calledFunction = match[1];
          
          // Vérifier si la fonction appelée existe dans d'autres fichiers
          for (const otherFile of this.files) {
            const targetFunction = otherFile.functions.find(f => f.name === calledFunction);
            if (targetFunction && otherFile.id !== file.id) {
              this.relationships.push({
                id: `call-${file.id}-${otherFile.id}-${calledFunction}`,
                source: file.id,
                target: otherFile.id,
                type: 'function_call',
                strength: 0.6,
                bidirectional: false
              });
              
              // Marquer la fonction comme utilisée
              targetFunction.isUsed = true;
              targetFunction.calledBy.push(func.name);
              func.calls.push(calledFunction);
            }
          }
        }
      }
    }
  }

  private resolveImportPath(importPath: string, currentFile: string): string | null {
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      const resolvedPath = path.resolve(path.dirname(currentFile), importPath);
      const relativePath = path.relative(this.projectPath, resolvedPath);
      
      // Chercher le fichier correspondant
      const targetFile = this.files.find(f => 
        f.path.startsWith(relativePath) || 
        f.path === relativePath + '.js' ||
        f.path === relativePath + '.ts' ||
        f.path === relativePath + '.jsx' ||
        f.path === relativePath + '.tsx'
      );
      
      return targetFile?.id || null;
    }
    
    return null;
  }

  private detectErrors() {
    for (const file of this.files) {
      // Fonctions non utilisées
      for (const func of file.functions) {
        if (!func.isUsed && func.name !== 'default' && !func.name.startsWith('use')) {
          this.errors.push({
            id: `unused-function-${file.id}-${func.name}`,
            type: 'unused_function',
            severity: 'warning',
            message: `Fonction '${func.name}' non utilisée`,
            file: file.path,
            line: func.line,
            column: func.column,
            suggestion: 'Supprimez cette fonction ou utilisez-la quelque part'
          });
        }
      }

      // Imports non résolus
      for (const importInfo of file.imports) {
        if (!importInfo.isResolved) {
          this.errors.push({
            id: `unresolved-import-${file.id}-${importInfo.source}`,
            type: 'missing_import',
            severity: 'error',
            message: `Import non résolu: '${importInfo.source}'`,
            file: file.path,
            line: importInfo.line,
            column: 1,
            suggestion: 'Vérifiez le chemin d\'import ou installez le package manquant'
          });
        }
      }

      // Complexité élevée
      if (file.complexity > 20) {
        this.errors.push({
          id: `high-complexity-${file.id}`,
          type: 'unreachable_code',
          severity: 'warning',
          message: `Complexité élevée (${file.complexity})`,
          file: file.path,
          line: 1,
          column: 1,
          suggestion: 'Considérez refactoriser ce fichier en plus petites fonctions'
        });
      }
    }
  }
}
