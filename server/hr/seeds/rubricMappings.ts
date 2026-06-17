// Sprint RH-3 — seed das 18 rubricas padrão do Domínio.
// Idempotente: usa ON CONFLICT(tenant_id, dominio_code) DO NOTHING.

import { db } from "../../db";
import { hrRubricMappings } from "@shared/schema";
import { sql } from "drizzle-orm";

const DEFAULTS: Array<Omit<typeof hrRubricMappings.$inferInsert, "tenantId" | "id" | "createdAt">> = [
  { dominioCode: "8781", dominioDescription: "Dias normais",                       type: "earning",  category: "salary",   affectsControl: true,  isSystem: true },
  { dominioCode: "8783", dominioDescription: "Dias férias",                        type: "earning",  category: "vacation", affectsControl: true,  isSystem: true },
  { dominioCode: "806",  dominioDescription: "Média horas férias",                 type: "earning",  category: "vacation", affectsControl: true,  isSystem: true },
  { dominioCode: "931",  dominioDescription: "1/3 das férias",                     type: "earning",  category: "vacation", affectsControl: true,  isSystem: true },
  { dominioCode: "8785", dominioDescription: "Dias afastamento INSS (doença)",    type: "earning",  category: "leave",    affectsControl: true,  isSystem: true },
  { dominioCode: "990",  dominioDescription: "Estouro do mês",                    type: "earning",  category: "other",    affectsControl: true,  isSystem: true },
  { dominioCode: "992",  dominioDescription: "Troco do mês",                      type: "earning",  category: "other",    affectsControl: true,  isSystem: true },
  { dominioCode: "8163", dominioDescription: "Troco férias",                      type: "earning",  category: "vacation", affectsControl: true,  isSystem: true },
  { dominioCode: "998",  dominioDescription: "INSS",                              type: "discount", category: "inss",     affectsControl: true,  isSystem: true },
  { dominioCode: "812",  dominioDescription: "INSS férias",                       type: "discount", category: "inss",     affectsControl: true,  isSystem: true },
  { dominioCode: "821",  dominioDescription: "INSS diferença férias",             type: "discount", category: "inss",     affectsControl: true,  isSystem: true },
  { dominioCode: "56",   dominioDescription: "Pensão alimentícia sobre líquido",  type: "discount", category: "alimony",  affectsControl: true,  isSystem: true },
  { dominioCode: "937",  dominioDescription: "Adiantamento de férias",            type: "discount", category: "advance",  affectsControl: true,  isSystem: true },
  { dominioCode: "8801", dominioDescription: "Desconto dias afastados",           type: "discount", category: "leave",    affectsControl: true,  isSystem: true },
  { dominioCode: "991",  dominioDescription: "Estouro mês anterior",              type: "discount", category: "other",    affectsControl: true,  isSystem: true },
  { dominioCode: "9750", dominioDescription: "Desc. emp. crédito trabalho",      type: "discount", category: "loan",     affectsControl: true,  isSystem: true },
  { dominioCode: "205",  dominioDescription: "Desc. emp. crédito trabalho (contrato)", type: "discount", category: "loan", affectsControl: true, isSystem: true },
  { dominioCode: "207",  dominioDescription: "Desc. emp. crédito trabalho (contrato)", type: "discount", category: "loan", affectsControl: true, isSystem: true },
];

export async function seedRubricMappings(tenantId: string): Promise<number> {
  let inserted = 0;
  for (const r of DEFAULTS) {
    const result = await db.execute(sql`
      INSERT INTO hr_rubric_mappings
        (tenant_id, dominio_code, dominio_description, type, category, affects_control, is_system)
      VALUES (${tenantId}, ${r.dominioCode}, ${r.dominioDescription}, ${r.type}, ${r.category}, ${r.affectsControl}, ${r.isSystem})
      ON CONFLICT (tenant_id, dominio_code) DO NOTHING
    `);
    inserted += (result as any).rowCount ?? 0;
  }
  return inserted;
}
