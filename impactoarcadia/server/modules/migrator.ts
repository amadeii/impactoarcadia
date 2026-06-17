/**
 * Arcádia Suite - Module Migrator
 * 
 * Executa migrações automáticas quando novos schemas são criados/aprovados.
 * Após aprovação de um schema no pipeline, este utilitário:
 * 1. Registra o schema no shared/schemas/index.ts
 * 2. Gera e aplica a migração no PostgreSQL via Drizzle
 */

import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface MigrationResult {
  success: boolean;
  moduleName: string;
  schemaRegistered: boolean;
  migrationApplied: boolean;
  error?: string;
}

export async function registerAndMigrate(moduleName: string): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    moduleName,
    schemaRegistered: false,
    migrationApplied: false,
  };

  try {
    const schemaPath = path.resolve(process.cwd(), `shared/schemas/${moduleName}.ts`);
    if (!fs.existsSync(schemaPath)) {
      result.error = `Schema não encontrado: shared/schemas/${moduleName}.ts`;
      return result;
    }

    const indexPath = path.resolve(process.cwd(), "shared/schemas/index.ts");
    let indexContent = fs.readFileSync(indexPath, "utf-8");
    const exportLine = `export * from "./${moduleName}";`;

    if (!indexContent.includes(exportLine)) {
      const marker = "// === MÓDULOS REGISTRADOS ===";
      if (indexContent.includes(marker)) {
        indexContent = indexContent.replace(
          marker,
          marker + "\n" + exportLine
        );
      } else {
        indexContent += "\n" + exportLine + "\n";
      }
      fs.writeFileSync(indexPath, indexContent, "utf-8");
      console.log(`[Migrator] Schema registrado: ${moduleName}`);
    }
    result.schemaRegistered = true;

    try {
      console.log(`[Migrator] Aplicando migração para módulo: ${moduleName}...`);
      await execAsync("npx drizzle-kit push", {
        cwd: process.cwd(),
        timeout: 30000,
        env: { ...process.env },
      });
      result.migrationApplied = true;
      console.log(`[Migrator] Migração aplicada com sucesso para: ${moduleName}`);
    } catch (migError: any) {
      console.error(`[Migrator] Erro na migração (não fatal):`, migError.message);
      result.error = `Schema registrado mas migração falhou: ${migError.message}. Execute manualmente: npx drizzle-kit push`;
      result.migrationApplied = false;
    }

    result.success = result.schemaRegistered;
    return result;
  } catch (error: any) {
    result.error = error.message;
    return result;
  }
}

export async function listModuleSchemas(): Promise<string[]> {
  const schemasDir = path.resolve(process.cwd(), "shared/schemas");
  if (!fs.existsSync(schemasDir)) return [];

  return fs.readdirSync(schemasDir)
    .filter(f => f.endsWith(".ts") && !f.startsWith("_") && f !== "index.ts" && f !== "loader.ts")
    .map(f => f.replace(".ts", ""));
}

export async function getModuleStatus(): Promise<Record<string, { hasSchema: boolean; hasRoutes: boolean; isRegistered: boolean }>> {
  const schemasDir = path.resolve(process.cwd(), "shared/schemas");
  const modulesDir = path.resolve(process.cwd(), "server/modules");
  const indexPath = path.resolve(process.cwd(), "shared/schemas/index.ts");

  const indexContent = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, "utf-8") : "";

  const schemaFiles = fs.existsSync(schemasDir)
    ? fs.readdirSync(schemasDir).filter(f => f.endsWith(".ts") && !f.startsWith("_") && f !== "index.ts" && f !== "loader.ts")
    : [];
  
  const routeFiles = fs.existsSync(modulesDir)
    ? fs.readdirSync(modulesDir).filter(f => f.endsWith(".ts") && !f.startsWith("_") && f !== "loader.ts" && f !== "migrator.ts")
    : [];

  const allModulesArr = [
    ...schemaFiles.map(f => f.replace(".ts", "")),
    ...routeFiles.map(f => f.replace(".ts", "")),
  ];
  const allModules = allModulesArr.filter((v, i, a) => a.indexOf(v) === i);

  const status: Record<string, { hasSchema: boolean; hasRoutes: boolean; isRegistered: boolean }> = {};
  for (const mod of allModules) {
    status[mod] = {
      hasSchema: schemaFiles.includes(`${mod}.ts`),
      hasRoutes: routeFiles.includes(`${mod}.ts`),
      isRegistered: indexContent.includes(`export * from "./${mod}"`),
    };
  }

  return status;
}
