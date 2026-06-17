/**
 * Arcádia Suite - Auto-loader de Schemas Modulares
 * 
 * Este arquivo exporta automaticamente todos os schemas de módulos.
 * O Dev Center (XOS Pipeline) pode criar novos arquivos aqui
 * e eles serão importados automaticamente pelo schema principal.
 * 
 * Convenção:
 * - Cada módulo cria um arquivo: shared/schemas/nomeModulo.ts
 * - Exporta tabelas, insert schemas e types
 * - Este index.ts re-exporta tudo
 * 
 * O schema principal (shared/schema.ts) importa e re-exporta este index.
 */

// Re-exportar todos os módulos registrados
// Novos módulos devem ser adicionados aqui pelo auto-registrador

// === MÓDULOS REGISTRADOS ===
export * from "./retail-reports";
export * from "./decor";
export * from "./hub";
export * from "./hub02";
export * from "./hub03";
export * from "./hub04";
export * from "./hub05";
export * from "./hub06";
export * from "./hub07";
// (módulos são adicionados automaticamente pelo pipeline)

export {};
