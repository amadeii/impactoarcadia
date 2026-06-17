// Shim: re-exporta db de db/index.ts para que server/control/* e server/hr/*
// possam importar via "../db" sem quebrar a estrutura do projeto.
export { db } from "../db/index";
