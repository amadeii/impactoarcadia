// Sprint RH-3 — Parser IA do Extrato Mensal Domínio.
// Usa runWithOrchestration → Anthropic (Claude) para extrair JSON estruturado.

import Anthropic from "@anthropic-ai/sdk";
import { runWithOrchestration } from "../../mcp/llmOrchestrator";

export interface RubricItem {
  code: string;
  description: string;
  type: "earning" | "discount" | "informative";
  reference: string;
  value: number;
}

export interface CollaboratorExtracted {
  employeeCode: string;
  fullName: string;
  cpf: string;
  admissionDate: string;
  situation: string;
  cargo: string;
  cboCargo: string;
  salaryBase: number;
  monthlyHours: number;
  costCenter: string;
  department: string;
  earnings: RubricItem[];
  discounts: RubricItem[];
  informatives: RubricItem[];
  totalGross: number;
  totalDiscounts: number;
  netSalary: number;
  inssBase: number;
  inssValue: number;
  fgtsBase: number;
  fgtsValue: number;
  irrfBase: number;
  irrfValue: number;
}

export interface ExtratoData {
  competence: string;
  cnpj: string;
  companyName: string;
  totalGross: number;
  totalDiscounts: number;
  totalNet: number;
  totalInss: number;
  totalFgts: number;
  collaborators: CollaboratorExtracted[];
}

const SYSTEM_PROMPT =
  "Você é um parser de documentos contábeis brasileiros. Retorne APENAS JSON válido (sem markdown, sem explicações).";

function buildPrompt(text: string): string {
  return `
Você receberá o texto extraído de um Extrato Mensal do sistema Domínio (software
contábil brasileiro). Extraia TODOS os dados e retorne APENAS um JSON válido,
sem texto adicional, sem markdown, sem explicações.

Estrutura esperada:
{
  "competence": "MM/AAAA",
  "cnpj": "XX.XXX.XXX/XXXX-XX",
  "companyName": "string",
  "totalGross": number,
  "totalDiscounts": number,
  "totalNet": number,
  "totalInss": number,
  "totalFgts": number,
  "collaborators": [
    {
      "employeeCode": "string",
      "fullName": "string",
      "cpf": "string",
      "admissionDate": "DD/MM/YYYY",
      "situation": "string",
      "cargo": "string",
      "cboCargo": "string",
      "salaryBase": number,
      "monthlyHours": number,
      "costCenter": "string",
      "department": "string",
      "earnings": [{"code":"string","description":"string","reference":"string","value":number}],
      "discounts": [{"code":"string","description":"string","reference":"string","value":number}],
      "informatives": [{"code":"string","description":"string","reference":"string","value":number}],
      "totalGross": number,
      "totalDiscounts": number,
      "netSalary": number,
      "inssBase": number, "inssValue": number,
      "fgtsBase": number, "fgtsValue": number,
      "irrfBase": number, "irrfValue": number
    }
  ]
}

Regras:
- Use ponto decimal (1234.56), nunca vírgula.
- Não invente colaboradores ausentes do texto.
- Se um campo não estiver presente, use string vazia ou 0.
- Mantenha os códigos das rubricas exatamente como no extrato (ex: 8781, 998).

Texto do Extrato:
${text}
`.trim();
}

function stripJsonFences(s: string): string {
  let out = s.trim();
  out = out.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");
  // Tenta isolar o primeiro objeto JSON top-level se houver lixo prefixado.
  const firstBrace = out.indexOf("{");
  const lastBrace = out.lastIndexOf("}");
  if (firstBrace > 0 && lastBrace > firstBrace) {
    out = out.slice(firstBrace, lastBrace + 1);
  }
  return out.trim();
}

export async function parseExtratoMensal(text: string, tenantId: string): Promise<ExtratoData> {
  const prompt = buildPrompt(text);

  const orch = await runWithOrchestration<string>(
    "hr:dominio_parse",
    tenantId,
    // Folha contém CPF/salários — sensível. Mas o parser exige LLM cloud
    // (Ollama local pode não dar conta de JSON longo confiável). Mantemos
    // sensitivity=internal e forçamos Anthropic.
    { sensitivity: "internal", forceProvider: "anthropic" },
    async (cb) => {
      if (cb.provider !== "anthropic") {
        throw new Error(`Parser exige Anthropic; orquestrador escolheu ${cb.provider}.`);
      }
      const client = new Anthropic({
        apiKey: cb.apiKey ?? undefined,
        baseURL: cb.baseUrl ?? undefined,
      });
      const resp: any = await client.messages.create({
        model: cb.model,
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
      } as any, { signal: cb.signal as any });
      const usage = resp?.usage || {};
      const content = (resp?.content || [])
        .filter((b: any) => b?.type === "text")
        .map((b: any) => String(b.text || ""))
        .join("\n")
        .trim();
      return {
        data: content,
        tokensIn: usage.input_tokens || 0,
        tokensOut: usage.output_tokens || 0,
      };
    },
  );

  const clean = stripJsonFences(orch.data);
  let data: ExtratoData;
  try {
    data = JSON.parse(clean) as ExtratoData;
  } catch (err: any) {
    throw new Error(`Resposta da IA não é JSON válido: ${err?.message || err}`);
  }
  if (!Array.isArray(data.collaborators)) {
    throw new Error("Resposta da IA sem array 'collaborators'");
  }

  // Validação de consistência: soma do líquido deve aproximar o total geral.
  const sumNet = data.collaborators.reduce((s, c) => s + Number(c.netSalary || 0), 0);
  const totalNet = Number(data.totalNet || 0);
  if (totalNet > 0 && Math.abs(sumNet - totalNet) > 1.0) {
    // Não bloqueia — só anota como warning na camada chamadora via comparação.
    console.warn(
      `[hr:parser] inconsistência líquido: extrato=${totalNet.toFixed(2)} ` +
      `vs soma=${sumNet.toFixed(2)} (diff=${(sumNet - totalNet).toFixed(2)})`,
    );
  }
  return data;
}
