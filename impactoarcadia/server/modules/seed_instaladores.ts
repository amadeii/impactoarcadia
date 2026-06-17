/**
 * DEC-AGE-01 — seed_instaladores.ts
 * Seed inicial da equipe de instalação.
 */
import pg from "pg";
import crypto from "crypto";

function getPool() {
  return new pg.Pool({ connectionString: process.env.DATABASE_URL });
}

const REGIOES_SC = [
  "Piçarras", "Penha", "Balneário Piçarras",
  "Balneário Camboriú", "Camboriú",
  "Itajaí", "Navegantes", "Barra Velha",
];

const INSTALADORES_PADRAO = [
  {
    nome: "Robson Bogo", telefone: "47 999723733",
    habilidades: ["cortina","persiana","tapete","papel_de_parede","motorizado","teto"],
    regioes: REGIOES_SC, maxInstalacoesDia: 3,
    jornadaInicio: "07:30", jornadaFim: "18:00",
    observacoes: "Proprietário e instalador principal. Especialidade: Wave e motorizados.",
  },
  {
    nome: "Instalador 2", telefone: "",
    habilidades: ["cortina","persiana"],
    regioes: ["Piçarras","Penha","Balneário Piçarras","Barra Velha"],
    maxInstalacoesDia: 2, jornadaInicio: "08:00", jornadaFim: "17:00",
    observacoes: "Equipe de campo. Editar nome e contato conforme a realidade.",
  },
  {
    nome: "Instalador 3", telefone: "",
    habilidades: ["cortina","tapete"],
    regioes: ["Balneário Camboriú","Camboriú","Itajaí","Navegantes"],
    maxInstalacoesDia: 2, jornadaInicio: "08:00", jornadaFim: "17:00",
    observacoes: "Equipe norte da região. Editar nome e contato conforme a realidade.",
  },
];

export async function runSeedInstaladores(tenantId: string): Promise<{ inseridos: number; existentes: number }> {
  const pool = getPool();
  let inseridos = 0; let existentes = 0;
  try {
    for (const inst of INSTALADORES_PADRAO) {
      const { rows: dup } = await pool.query(
        `SELECT id FROM cortiart_instaladores WHERE tenant_id = $1 AND nome = $2`,
        [tenantId, inst.nome]
      );
      if (dup.length > 0) { existentes++; continue; }
      await pool.query(
        `INSERT INTO cortiart_instaladores
           (id, tenant_id, nome, telefone, habilidades, regioes,
            max_instalacoes_dia, jornada_inicio, jornada_fim, observacoes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [crypto.randomUUID(), tenantId, inst.nome, inst.telefone,
         inst.habilidades, inst.regioes, inst.maxInstalacoesDia,
         inst.jornadaInicio, inst.jornadaFim, inst.observacoes]
      );
      inseridos++;
    }
    console.log(`[DEC-AGE-01 Seed] ${inseridos} instaladores criados, ${existentes} já existiam.`);
    return { inseridos, existentes };
  } finally {
    await pool.end();
  }
}
