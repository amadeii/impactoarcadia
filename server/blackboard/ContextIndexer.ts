/**
 * Arcadia Suite - Context Indexer
 * 
 * Cria um mapa do projeto para dar contexto aos agentes.
 * Analisa estrutura, rotas, schemas e dependências.
 */

import * as fs from "fs/promises";
import * as path from "path";

export interface ProjectContext {
  timestamp: string;
  structure: DirectoryNode;
  schemas: SchemaInfo[];
  routes: RouteInfo[];
  components: ComponentInfo[];
  dependencies: DependencyInfo;
}

export interface DirectoryNode {
  name: string;
  type: "file" | "directory";
  path: string;
  children?: DirectoryNode[];
  size?: number;
}

export interface SchemaInfo {
  name: string;
  file: string;
  columns: string[];
}

export interface RouteInfo {
  method: string;
  path: string;
  file: string;
}

export interface ComponentInfo {
  name: string;
  file: string;
  type: "page" | "component" | "hook";
}

export interface DependencyInfo {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

const SCAN_DIRS = ["client/src", "server", "shared"];
const IGNORE_DIRS = ["node_modules", ".git", "dist", "build", "__pycache__", ".next"];
const CODE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

class ContextIndexer {
  private cachedContext: ProjectContext | null = null;
  private cacheTime: number = 0;
  private cacheDuration = 60000; // 1 minuto

  async getContext(forceRefresh = false): Promise<ProjectContext> {
    const now = Date.now();
    
    if (!forceRefresh && this.cachedContext && (now - this.cacheTime) < this.cacheDuration) {
      return this.cachedContext;
    }

    console.log("[ContextIndexer] Indexando projeto...");
    
    const context: ProjectContext = {
      timestamp: new Date().toISOString(),
      structure: await this.scanDirectory(process.cwd(), 0, 3),
      schemas: await this.extractSchemas(),
      routes: await this.extractRoutes(),
      components: await this.extractComponents(),
      dependencies: await this.extractDependencies(),
    };

    this.cachedContext = context;
    this.cacheTime = now;

    console.log(`[ContextIndexer] Indexado: ${context.schemas.length} schemas, ${context.routes.length} rotas, ${context.components.length} componentes`);

    return context;
  }

  async getContextSummary(): Promise<string> {
    const ctx = await this.getContext();

    const lines: string[] = [
      "# Contexto do Projeto Arcadia Suite\n",
      "## Estrutura Principal",
      "```",
      this.formatStructure(ctx.structure, 0),
      "```\n",
      "## Schemas do Banco de Dados",
      ...ctx.schemas.slice(0, 20).map(s => `- **${s.name}**: ${s.columns.slice(0, 5).join(", ")}${s.columns.length > 5 ? "..." : ""}`),
      "\n## Rotas da API",
      ...ctx.routes.slice(0, 30).map(r => `- \`${r.method} ${r.path}\` (${r.file})`),
      "\n## Componentes React",
      ...ctx.components.slice(0, 20).map(c => `- **${c.name}** (${c.type}): ${c.file}`),
      "\n## Dependências Principais",
      ...Object.entries(ctx.dependencies.dependencies || {}).slice(0, 15).map(([k, v]) => `- ${k}: ${v}`),
    ];

    return lines.join("\n");
  }

  private async scanDirectory(dirPath: string, depth: number, maxDepth: number): Promise<DirectoryNode> {
    const name = path.basename(dirPath);
    const relativePath = path.relative(process.cwd(), dirPath);

    if (depth >= maxDepth) {
      return { name, type: "directory", path: relativePath };
    }

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const children: DirectoryNode[] = [];

      for (const entry of entries) {
        if (IGNORE_DIRS.includes(entry.name)) continue;
        if (entry.name.startsWith(".") && entry.name !== ".env.example") continue;

        const fullPath = path.join(dirPath, entry.name);
        const relPath = path.relative(process.cwd(), fullPath);

        if (entry.isDirectory()) {
          if (SCAN_DIRS.some(d => relPath.startsWith(d)) || depth === 0) {
            children.push(await this.scanDirectory(fullPath, depth + 1, maxDepth));
          }
        } else {
          const ext = path.extname(entry.name);
          if (CODE_EXTENSIONS.includes(ext) || [".json", ".md", ".css"].includes(ext)) {
            try {
              const stats = await fs.stat(fullPath);
              children.push({ name: entry.name, type: "file", path: relPath, size: stats.size });
            } catch {}
          }
        }
      }

      return { name, type: "directory", path: relativePath, children };
    } catch {
      return { name, type: "directory", path: relativePath };
    }
  }

  private async extractSchemas(): Promise<SchemaInfo[]> {
    const schemas: SchemaInfo[] = [];

    try {
      const schemaPath = path.join(process.cwd(), "shared/schema.ts");
      const content = await fs.readFile(schemaPath, "utf-8");

      const tableRegex = /export const (\w+) = pgTable\("(\w+)",\s*\{([^}]+)\}/g;
      let match;

      while ((match = tableRegex.exec(content)) !== null) {
        const columns = match[3]
          .split(",")
          .map(c => c.trim().split(":")[0]?.trim())
          .filter(c => c && !c.startsWith("//"));

        schemas.push({
          name: match[1],
          file: "shared/schema.ts",
          columns,
        });
      }
    } catch {}

    return schemas;
  }

  private async extractRoutes(): Promise<RouteInfo[]> {
    const routes: RouteInfo[] = [];

    try {
      const routesPath = path.join(process.cwd(), "server/routes.ts");
      const content = await fs.readFile(routesPath, "utf-8");

      const routeRegex = /app\.(get|post|put|patch|delete)\s*\(\s*["'`]([^"'`]+)["'`]/gi;
      let match;

      while ((match = routeRegex.exec(content)) !== null) {
        routes.push({
          method: match[1].toUpperCase(),
          path: match[2],
          file: "server/routes.ts",
        });
      }

      const useRegex = /app\.use\s*\(\s*["'`]([^"'`]+)["'`]/gi;
      while ((match = useRegex.exec(content)) !== null) {
        routes.push({
          method: "USE",
          path: match[1],
          file: "server/routes.ts",
        });
      }
    } catch {}

    return routes;
  }

  private async extractComponents(): Promise<ComponentInfo[]> {
    const components: ComponentInfo[] = [];
    const pagesDir = path.join(process.cwd(), "client/src/pages");

    try {
      const files = await fs.readdir(pagesDir);

      for (const file of files) {
        if (file.endsWith(".tsx") || file.endsWith(".jsx")) {
          const name = file.replace(/\.(tsx|jsx)$/, "");
          components.push({
            name,
            file: `client/src/pages/${file}`,
            type: "page",
          });
        }
      }
    } catch {}

    const componentsDir = path.join(process.cwd(), "client/src/components");

    try {
      const files = await fs.readdir(componentsDir);

      for (const file of files) {
        if (file.endsWith(".tsx") || file.endsWith(".jsx")) {
          const name = file.replace(/\.(tsx|jsx)$/, "");
          components.push({
            name,
            file: `client/src/components/${file}`,
            type: "component",
          });
        }
      }
    } catch {}

    return components;
  }

  private async extractDependencies(): Promise<DependencyInfo> {
    try {
      const pkgPath = path.join(process.cwd(), "package.json");
      const content = await fs.readFile(pkgPath, "utf-8");
      const pkg = JSON.parse(content);

      return {
        dependencies: pkg.dependencies || {},
        devDependencies: pkg.devDependencies || {},
      };
    } catch {
      return { dependencies: {}, devDependencies: {} };
    }
  }

  private formatStructure(node: DirectoryNode, indent: number): string {
    const prefix = "  ".repeat(indent);
    let result = `${prefix}${node.type === "directory" ? "📁" : "📄"} ${node.name}\n`;

    if (node.children) {
      for (const child of node.children.slice(0, 15)) {
        result += this.formatStructure(child, indent + 1);
      }
      if (node.children.length > 15) {
        result += `${prefix}  ... e mais ${node.children.length - 15} itens\n`;
      }
    }

    return result;
  }
}

export const contextIndexer = new ContextIndexer();
