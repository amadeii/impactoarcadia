/**
 * Arcádia Suite - Module Routes Auto-Loader
 * 
 * Carrega automaticamente todas as rotas de módulos em server/modules/.
 * Cada arquivo exporta um Router do Express, montado em /api/modules/{nome}.
 * 
 * Arquivos que começam com _ são ignorados (_template.ts, _utils.ts).
 * O loader é chamado pelo routes.ts central.
 */

import type { Express } from "express";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

function getDirname(): string {
  try {
    if (typeof __dirname !== "undefined") return __dirname;
  } catch {}
  try {
    const currentFile = fileURLToPath(import.meta.url);
    return path.dirname(currentFile);
  } catch {}
  return path.resolve("server/modules");
}

const currentDir = getDirname();

export async function loadModuleRoutes(app: Express): Promise<string[]> {
  const modulesDir = path.resolve(currentDir);
  const loaded: string[] = [];

  if (!fs.existsSync(modulesDir)) {
    return loaded;
  }

  const files = fs.readdirSync(modulesDir);
  const moduleFiles = files.filter(
    f => (f.endsWith(".ts") || f.endsWith(".js")) &&
         !f.startsWith("_") &&
         f !== "loader.ts" &&
         f !== "loader.js" &&
         f !== "migrator.ts" &&
         f !== "migrator.js"
  );

  for (const file of moduleFiles) {
    const moduleName = file.replace(/\.(ts|js)$/, "");
    try {
      const modulePath = path.join(modulesDir, file);
      const mod = await import(modulePath);
      const router = mod.default || mod.router;

      if (router) {
        app.use(`/api/modules/${moduleName}`, router);
        loaded.push(moduleName);
        console.log(`[ModuleLoader] Módulo carregado: /api/modules/${moduleName}`);
      } else {
        console.warn(`[ModuleLoader] Módulo ${moduleName} não exporta router default`);
      }
    } catch (error: any) {
      console.error(`[ModuleLoader] Erro ao carregar módulo ${moduleName}:`, error.message);
    }
  }

  if (loaded.length > 0) {
    console.log(`[ModuleLoader] ${loaded.length} módulos carregados: ${loaded.join(", ")}`);
  }

  return loaded;
}

export function getLoadedModules(): string[] {
  const modulesDir = path.resolve(currentDir);
  if (!fs.existsSync(modulesDir)) return [];
  
  return fs.readdirSync(modulesDir)
    .filter(f => (f.endsWith(".ts") || f.endsWith(".js")) && !f.startsWith("_") && f !== "loader.ts" && f !== "loader.js" && f !== "migrator.ts" && f !== "migrator.js")
    .map(f => f.replace(/\.(ts|js)$/, ""));
}
