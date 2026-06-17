/**
 * Arcádia Suite — Módulo Decor
 * Seed de coeficientes de metragem e catálogo inicial
 */
import pg from "pg";

async function getPool() {
  return new pg.Pool({ connectionString: process.env.DATABASE_URL });
}

// ─── 36 Coeficientes de metragem de tecido ────────────────────────────────
const COEFICIENTES = [
  // WAVE (franzido 2x a 3x conforme largura)
  { sistema: "wave", faixa: "ate_1m",    coeficiente: "3.20", descricao: "Wave até 1m — franzido máximo" },
  { sistema: "wave", faixa: "1m_2m",     coeficiente: "3.00", descricao: "Wave 1m–2m — padrão" },
  { sistema: "wave", faixa: "2m_3m",     coeficiente: "2.80", descricao: "Wave 2m–3m — escala" },
  { sistema: "wave", faixa: "acima_3m",  coeficiente: "2.50", descricao: "Wave acima de 3m — grande vão" },

  // XALE (drapeado caído)
  { sistema: "xale", faixa: "ate_1m",    coeficiente: "2.80", descricao: "Xale até 1m" },
  { sistema: "xale", faixa: "1m_2m",     coeficiente: "2.50", descricao: "Xale 1m–2m — padrão" },
  { sistema: "xale", faixa: "2m_3m",     coeficiente: "2.20", descricao: "Xale 2m–3m" },
  { sistema: "xale", faixa: "acima_3m",  coeficiente: "2.00", descricao: "Xale acima de 3m" },

  // BLACKOUT TECIDO (franzido moderado)
  { sistema: "blackout_tecido", faixa: "ate_1m",   coeficiente: "2.20", descricao: "Blackout tecido até 1m" },
  { sistema: "blackout_tecido", faixa: "1m_2m",    coeficiente: "2.00", descricao: "Blackout tecido 1m–2m" },
  { sistema: "blackout_tecido", faixa: "2m_3m",    coeficiente: "1.90", descricao: "Blackout tecido 2m–3m" },
  { sistema: "blackout_tecido", faixa: "acima_3m", coeficiente: "1.80", descricao: "Blackout tecido acima 3m" },

  // BLACKOUT ROLO (sem franzido — metragem = altura + margem)
  { sistema: "blackout_rolo", faixa: "ate_1m",   coeficiente: "1.15", descricao: "Blackout rolo até 1m" },
  { sistema: "blackout_rolo", faixa: "1m_2m",    coeficiente: "1.12", descricao: "Blackout rolo 1m–2m" },
  { sistema: "blackout_rolo", faixa: "2m_3m",    coeficiente: "1.10", descricao: "Blackout rolo 2m–3m" },
  { sistema: "blackout_rolo", faixa: "acima_3m", coeficiente: "1.08", descricao: "Blackout rolo acima 3m" },

  // CORTINA DUPLA (wave + blackout rolo)
  { sistema: "dupla_wave_blackout", faixa: "ate_1m",   coeficiente: "3.20", descricao: "Trilho duplo — layer wave até 1m" },
  { sistema: "dupla_wave_blackout", faixa: "1m_2m",    coeficiente: "3.00", descricao: "Trilho duplo — layer wave 1m–2m" },
  { sistema: "dupla_wave_blackout", faixa: "2m_3m",    coeficiente: "2.80", descricao: "Trilho duplo — layer wave 2m–3m" },
  { sistema: "dupla_wave_blackout", faixa: "acima_3m", coeficiente: "2.50", descricao: "Trilho duplo — layer wave acima 3m" },

  // TRILHO SIMPLES (argola / passador)
  { sistema: "trilho_simples", faixa: "ate_1m",   coeficiente: "2.80", descricao: "Trilho simples até 1m" },
  { sistema: "trilho_simples", faixa: "1m_2m",    coeficiente: "2.50", descricao: "Trilho simples 1m–2m" },
  { sistema: "trilho_simples", faixa: "2m_3m",    coeficiente: "2.20", descricao: "Trilho simples 2m–3m" },
  { sistema: "trilho_simples", faixa: "acima_3m", coeficiente: "2.00", descricao: "Trilho simples acima 3m" },

  // PERSIANA HORIZONTAL (não usa tecido — coeficiente informativo)
  { sistema: "persiana_horizontal", faixa: "ate_1m",   coeficiente: "1.00", descricao: "Persiana horizontal — coef. 1:1" },
  { sistema: "persiana_horizontal", faixa: "1m_2m",    coeficiente: "1.00", descricao: "Persiana horizontal — coef. 1:1" },
  { sistema: "persiana_horizontal", faixa: "2m_3m",    coeficiente: "1.00", descricao: "Persiana horizontal — coef. 1:1" },
  { sistema: "persiana_horizontal", faixa: "acima_3m", coeficiente: "1.00", descricao: "Persiana horizontal — coef. 1:1" },

  // PERSIANA VERTICAL
  { sistema: "persiana_vertical", faixa: "ate_1m",   coeficiente: "1.05", descricao: "Persiana vertical — margem corte" },
  { sistema: "persiana_vertical", faixa: "1m_2m",    coeficiente: "1.05", descricao: "Persiana vertical — margem corte" },
  { sistema: "persiana_vertical", faixa: "2m_3m",    coeficiente: "1.05", descricao: "Persiana vertical — margem corte" },
  { sistema: "persiana_vertical", faixa: "acima_3m", coeficiente: "1.05", descricao: "Persiana vertical — margem corte" },

  // PAINEL JAPONÊS
  { sistema: "painel_japones", faixa: "ate_1m",   coeficiente: "1.20", descricao: "Painel japonês até 1m" },
  { sistema: "painel_japones", faixa: "1m_2m",    coeficiente: "1.15", descricao: "Painel japonês 1m–2m" },
  { sistema: "painel_japones", faixa: "2m_3m",    coeficiente: "1.10", descricao: "Painel japonês 2m–3m" },
  { sistema: "painel_japones", faixa: "acima_3m", coeficiente: "1.10", descricao: "Painel japonês acima 3m" },
];

// ─── Catálogo inicial (~50 itens reais) ──────────────────────────────────
const CATALOGO = [
  // TECIDOS — Coleção Linho Natural
  { codigo: "LN-01", nome: "Linho Natural Cru",         categoria: "tecido", colecao: "Linho Natural",  unidade: "m",  valor_unitario: "85.00",  status_comercial: "ativo",    descricao: "Linho 100% natural tom cru, leveza e transparência elegante" },
  { codigo: "LN-02", nome: "Linho Natural Areia",        categoria: "tecido", colecao: "Linho Natural",  unidade: "m",  valor_unitario: "85.00",  status_comercial: "ativo",    descricao: "Linho tom areia quente, combina com madeira" },
  { codigo: "LN-03", nome: "Linho Natural Cinza Claro",  categoria: "tecido", colecao: "Linho Natural",  unidade: "m",  valor_unitario: "90.00",  status_comercial: "ativo",    descricao: "Linho tom cinza claro, sofisticado e versátil" },
  { codigo: "LN-04", nome: "Linho Natural Branco Puro",  categoria: "tecido", colecao: "Linho Natural",  unidade: "m",  valor_unitario: "95.00",  status_comercial: "ativo",    descricao: "Linho branco puro, filtro de luz clean" },

  // TECIDOS — Coleção Blackout Soft
  { codigo: "BK-01", nome: "Blackout Soft Off-White",    categoria: "tecido", colecao: "Blackout Soft",  unidade: "m",  valor_unitario: "120.00", status_comercial: "ativo",    descricao: "Blackout tecido 100% com face veludo off-white" },
  { codigo: "BK-02", nome: "Blackout Soft Cinza Chumbo", categoria: "tecido", colecao: "Blackout Soft",  unidade: "m",  valor_unitario: "120.00", status_comercial: "ativo",    descricao: "Blackout tecido cinza chumbo, elegante e funcional" },
  { codigo: "BK-03", nome: "Blackout Soft Bege",         categoria: "tecido", colecao: "Blackout Soft",  unidade: "m",  valor_unitario: "115.00", status_comercial: "ativo",    descricao: "Blackout tecido bege, clássico e versátil" },
  { codigo: "BK-04", nome: "Blackout Soft Branco",       categoria: "tecido", colecao: "Blackout Soft",  unidade: "m",  valor_unitario: "118.00", status_comercial: "ativo",    descricao: "Blackout tecido branco, pureza e bloqueio total" },
  { codigo: "BK-05", nome: "Blackout Soft Azul Petroleo",categoria: "tecido", colecao: "Blackout Soft",  unidade: "m",  valor_unitario: "128.00", status_comercial: "ativo",    descricao: "Blackout tecido azul petróleo, destaque moderno" },

  // TECIDOS — Coleção Wave Premium
  { codigo: "WP-01", nome: "Wave Sheer Branco",          categoria: "tecido", colecao: "Wave Premium",   unidade: "m",  valor_unitario: "145.00", status_comercial: "ativo",    descricao: "Voil sheer branco para trilho Wave, efeito nuvem" },
  { codigo: "WP-02", nome: "Wave Sheer Pérola",          categoria: "tecido", colecao: "Wave Premium",   unidade: "m",  valor_unitario: "155.00", status_comercial: "ativo",    descricao: "Voil sheer pérola para trilho Wave, sofisticado" },
  { codigo: "WP-03", nome: "Wave Sheer Cinza",           categoria: "tecido", colecao: "Wave Premium",   unidade: "m",  valor_unitario: "150.00", status_comercial: "ativo",    descricao: "Voil sheer cinza para trilho Wave" },
  { codigo: "WP-04", nome: "Wave Linho Off-White",       categoria: "tecido", colecao: "Wave Premium",   unidade: "m",  valor_unitario: "175.00", status_comercial: "ativo",    descricao: "Linho pesado off-white para Wave, efeito encorpado" },

  // TECIDOS — Coleção Veludo
  { codigo: "VL-01", nome: "Veludo Grafite",             categoria: "tecido", colecao: "Veludo",         unidade: "m",  valor_unitario: "210.00", status_comercial: "ativo",    descricao: "Veludo grafite 280g, acústico e blackout natural" },
  { codigo: "VL-02", nome: "Veludo Vinho",               categoria: "tecido", colecao: "Veludo",         unidade: "m",  valor_unitario: "210.00", status_comercial: "ativo",    descricao: "Veludo vinho, cor forte para ambientes sofisticados" },
  { codigo: "VL-03", nome: "Veludo Azul Royal",          categoria: "tecido", colecao: "Veludo",         unidade: "m",  valor_unitario: "220.00", status_comercial: "ativo",    descricao: "Veludo azul royal, teatral e elegante" },
  { codigo: "VL-04", nome: "Veludo Verde Esmeralda",     categoria: "tecido", colecao: "Veludo",         unidade: "m",  valor_unitario: "225.00", status_comercial: "em_falta", descricao: "Veludo verde esmeralda — aguardando reposição" },

  // SISTEMAS — Trilhos Wave
  { codigo: "TW-S", nome: "Trilho Wave Simples",         categoria: "sistema", colecao: null,            unidade: "m",  valor_unitario: "65.00",  status_comercial: "ativo",    descricao: "Trilho Wave alumínio anodizado — 1 carril" },
  { codigo: "TW-D", nome: "Trilho Wave Duplo",           categoria: "sistema", colecao: null,            unidade: "m",  valor_unitario: "95.00",  status_comercial: "ativo",    descricao: "Trilho Wave alumínio duplo — day/night" },
  { codigo: "TW-M", nome: "Trilho Wave Motorizado",      categoria: "sistema", colecao: null,            unidade: "m",  valor_unitario: "220.00", status_comercial: "ativo",    descricao: "Trilho Wave com motor embutido e controle remoto" },

  // SISTEMAS — Trilhos Simples
  { codigo: "TS-BR", nome: "Trilho Simples Branco",      categoria: "sistema", colecao: null,            unidade: "m",  valor_unitario: "35.00",  status_comercial: "ativo",    descricao: "Trilho reto alumínio branco com argolas" },
  { codigo: "TS-PR", nome: "Trilho Simples Preto",       categoria: "sistema", colecao: null,            unidade: "m",  valor_unitario: "35.00",  status_comercial: "ativo",    descricao: "Trilho reto alumínio preto com argolas" },
  { codigo: "TS-DB", nome: "Trilho Simples Duplo Branco",categoria: "sistema", colecao: null,            unidade: "m",  valor_unitario: "55.00",  status_comercial: "ativo",    descricao: "Trilho duplo reto branco para day/night" },

  // PERSIANAS
  { codigo: "PR-RL", nome: "Persiana Rolo Blackout Branca",  categoria: "persiana", colecao: null,       unidade: "m2", valor_unitario: "180.00", status_comercial: "ativo",    descricao: "Persiana rolo blackout 100% branca, sob medida" },
  { codigo: "PR-RC", nome: "Persiana Rolo Blackout Cinza",   categoria: "persiana", colecao: null,       unidade: "m2", valor_unitario: "185.00", status_comercial: "ativo",    descricao: "Persiana rolo blackout cinza, sob medida" },
  { codigo: "PR-RT", nome: "Persiana Rolo Tela Solar 5%",    categoria: "persiana", colecao: null,       unidade: "m2", valor_unitario: "195.00", status_comercial: "ativo",    descricao: "Persiana rolo tela solar 5% — filtra UV sem escurecer" },
  { codigo: "PH-25", nome: "Persiana Horizontal Alumínio 25mm", categoria: "persiana", colecao: null,   unidade: "m2", valor_unitario: "120.00", status_comercial: "ativo",    descricao: "Persiana horizontal alumínio 25mm, lâminas coloridas" },
  { codigo: "PV-89", nome: "Persiana Vertical PVC 89mm",     categoria: "persiana", colecao: null,       unidade: "m2", valor_unitario: "140.00", status_comercial: "ativo",    descricao: "Persiana vertical PVC 89mm, rotação 180°" },

  // ACESSÓRIOS
  { codigo: "AC-BR", nome: "Bracadeira Dupla",            categoria: "acessorio", colecao: null,         unidade: "un", valor_unitario: "12.00",  status_comercial: "ativo",    descricao: "Braçadeira dupla para fixação de trilho no teto/parede" },
  { codigo: "AC-FI", nome: "Fita Wave 100mm",             categoria: "acessorio", colecao: null,         unidade: "m",  valor_unitario: "8.50",   status_comercial: "ativo",    descricao: "Fita porta-carro Wave 100mm para costura" },
  { codigo: "AC-AR", nome: "Argola Simples Inox",         categoria: "acessorio", colecao: null,         unidade: "un", valor_unitario: "2.50",   status_comercial: "ativo",    descricao: "Argola simples inox para trilho passador" },
  { codigo: "AC-MT", nome: "Motor WiFi para Trilho",      categoria: "acessorio", colecao: null,         unidade: "un", valor_unitario: "650.00", status_comercial: "ativo",    descricao: "Motor WiFi Somfy ou compatível para trilhos elétricos" },
  { codigo: "AC-CR", nome: "Controle Remoto Universal",   categoria: "acessorio", colecao: null,         unidade: "un", valor_unitario: "95.00",  status_comercial: "ativo",    descricao: "Controle remoto universal para motores de persiana/trilho" },

  // MÃO DE OBRA
  { codigo: "MO-MD", nome: "Mão de Obra — Medição Técnica",       categoria: "mao_obra", colecao: null,  unidade: "un", valor_unitario: "150.00", status_comercial: "ativo",    descricao: "Visita técnica para medição de vãos, até 5 ambientes" },
  { codigo: "MO-CT", nome: "Mão de Obra — Corte e Costura m²",    categoria: "mao_obra", colecao: null,  unidade: "m2", valor_unitario: "45.00",  status_comercial: "ativo",    descricao: "Costura de cortina por m² de tecido processado" },
  { codigo: "MO-IT", nome: "Mão de Obra — Instalação Trilho/m",   categoria: "mao_obra", colecao: null,  unidade: "m",  valor_unitario: "35.00",  status_comercial: "ativo",    descricao: "Instalação de trilho por metro linear" },
  { codigo: "MO-IP", nome: "Mão de Obra — Instalação Persiana/un",categoria: "mao_obra", colecao: null,  unidade: "un", valor_unitario: "80.00",  status_comercial: "ativo",    descricao: "Instalação de persiana por unidade" },
  { codigo: "MO-IC", nome: "Mão de Obra — Instalação Cortina/amb",categoria: "mao_obra", colecao: null,  unidade: "un", valor_unitario: "120.00", status_comercial: "ativo",    descricao: "Instalação completa de cortinas por ambiente" },
  { codigo: "MO-DM", nome: "Mão de Obra — Desmontagem",           categoria: "mao_obra", colecao: null,  unidade: "un", valor_unitario: "80.00",  status_comercial: "ativo",    descricao: "Desmontagem e retirada de cortinas/persianas antigas" },
];

export async function runDecorSeed(): Promise<{ coeficientes: number; catalogo: number }> {
  const pool = await getPool();
  let coefCount = 0;
  let catCount = 0;

  try {
    for (const c of COEFICIENTES) {
      await pool.query(
        `INSERT INTO cortiart_coeficientes (sistema, faixa, coeficiente, descricao)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (sistema, faixa) DO UPDATE SET
           coeficiente = EXCLUDED.coeficiente,
           descricao   = EXCLUDED.descricao`,
        [c.sistema, c.faixa, c.coeficiente, c.descricao]
      );
      coefCount++;
    }
    console.log(`[decorSeed] ${coefCount} coeficientes: OK`);

    for (const item of CATALOGO) {
      await pool.query(
        `INSERT INTO cortiart_catalogo
           (codigo, nome, categoria, colecao, unidade, valor_unitario, status_comercial, descricao)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT DO NOTHING`,
        [item.codigo, item.nome, item.categoria, item.colecao ?? null, item.unidade, item.valor_unitario, item.status_comercial, item.descricao]
      );
      catCount++;
    }
    console.log(`[decorSeed] ${catCount} itens catálogo: OK`);
  } finally {
    await pool.end();
  }

  return { coeficientes: coefCount, catalogo: catCount };
}
