/**
 * Arcádia Suite - Schema Module Loader
 * 
 * Utilitário para registro dinâmico de schemas modulares.
 * Quando o pipeline cria um novo schema em shared/schemas/,
 * ele também adiciona a linha de export no index.ts.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getRegisteredModules(): string[] {
  const schemasDir = path.resolve(__dirname);
  const files = fs.readdirSync(schemasDir);
  return files
    .filter(f => f.endsWith(".ts") && !f.startsWith("_") && f !== "index.ts" && f !== "loader.ts")
    .map(f => f.replace(".ts", ""));
}

export function generateSchemaExports(): string {
  const modules = getRegisteredModules();
  if (modules.length === 0) return "// Nenhum módulo registrado ainda\n";

  return modules
    .map(mod => `export * from "./${mod}";`)
    .join("\n") + "\n";
}

export async function registerModuleSchema(moduleName: string): Promise<boolean> {
  const indexPath = path.resolve(__dirname, "index.ts");
  let content = fs.readFileSync(indexPath, "utf-8");

  const exportLine = `export * from "./${moduleName}";`;
  if (content.includes(exportLine)) {
    return true;
  }

  const marker = "// === MÓDULOS REGISTRADOS ===";
  if (content.includes(marker)) {
    content = content.replace(
      marker + "\n",
      marker + "\n" + exportLine + "\n"
    );
  } else {
    content += "\n" + exportLine + "\n";
  }

  fs.writeFileSync(indexPath, content, "utf-8");
  return true;
}

export async function unregisterModuleSchema(moduleName: string): Promise<boolean> {
  const indexPath = path.resolve(__dirname, "index.ts");
  let content = fs.readFileSync(indexPath, "utf-8");

  const exportLine = `export * from "./${moduleName}";\n`;
  content = content.replace(exportLine, "");

  fs.writeFileSync(indexPath, content, "utf-8");
  return true;
}
