/**
 * DEC-EXP-07 — seed do catálogo (tapetes, papel de parede, double vision, mosquiteiro, MO)
 */
import pg from "pg";

function getPool() {
  return new pg.Pool({ connectionString: process.env.DATABASE_URL });
}

const CATALOGO_EXP07 = [
  // Tapetes
  { codigo:"TP-PP-01", nome:"Tapete Polipropileno Premium Bege",         categoria:"tapete",          colecao:"Polipropileno", unidade:"m²",   valor_unitario:"180.00", status_comercial:"ativo", descricao:"Tapete polipropileno resistente, fácil limpeza, tom bege" },
  { codigo:"TP-PP-02", nome:"Tapete Polipropileno Premium Cinza",         categoria:"tapete",          colecao:"Polipropileno", unidade:"m²",   valor_unitario:"180.00", status_comercial:"ativo", descricao:"Tapete polipropileno resistente, fácil limpeza, tom cinza" },
  { codigo:"TP-VC-01", nome:"Tapete Viscose Natural Cru",                 categoria:"tapete",          colecao:"Viscose",       unidade:"m²",   valor_unitario:"320.00", status_comercial:"ativo", descricao:"Tapete viscose natural, toque sedoso, cor cru" },
  { codigo:"TP-LA-01", nome:"Tapete Lã Natural Off-White",               categoria:"tapete",          colecao:"Lã Natural",    unidade:"m²",   valor_unitario:"480.00", status_comercial:"ativo", descricao:"Tapete de lã natural artesanal, off-white, durável" },
  { codigo:"TP-JU-01", nome:"Tapete Juta Natural",                        categoria:"tapete",          colecao:"Natural",       unidade:"m²",   valor_unitario:"140.00", status_comercial:"ativo", descricao:"Tapete juta trançada, ecológico e resistente" },
  { codigo:"TP-SI-01", nome:"Tapete Sisal Premium",                       categoria:"tapete",          colecao:"Natural",       unidade:"m²",   valor_unitario:"160.00", status_comercial:"ativo", descricao:"Tapete sisal natural, antiderrapante" },
  { codigo:"TP-PE-01", nome:"Tapete Pelo Alto Cinza",                     categoria:"tapete",          colecao:"Pelo Alto",     unidade:"m²",   valor_unitario:"380.00", status_comercial:"ativo", descricao:"Tapete pelo alto macio, cor cinza, confortável" },
  // Papel de parede
  { codigo:"PP-TX-01", nome:"Papel de Parede Texturizado Linho Bege",     categoria:"papel_de_parede", colecao:"Texturas",      unidade:"rolo", valor_unitario:"85.00",  status_comercial:"ativo", descricao:"Papel de parede vinílico textura linho, rolo 0,53m × 10m" },
  { codigo:"PP-TX-02", nome:"Papel de Parede Texturizado Concreto Cinza", categoria:"papel_de_parede", colecao:"Texturas",      unidade:"rolo", valor_unitario:"90.00",  status_comercial:"ativo", descricao:"Papel vinílico efeito concreto, sofisticado, 0,53m × 10m" },
  { codigo:"PP-LIS-01",nome:"Papel de Parede Liso Off-White",             categoria:"papel_de_parede", colecao:"Liso",          unidade:"rolo", valor_unitario:"65.00",  status_comercial:"ativo", descricao:"Papel de parede liso lavável off-white, 0,53m × 10m" },
  { codigo:"PP-GEO-01",nome:"Papel de Parede Geométrico Azul",           categoria:"papel_de_parede", colecao:"Geométricos",   unidade:"rolo", valor_unitario:"110.00", status_comercial:"ativo", descricao:"Papel vinílico padrão geométrico azul moderno, 0,53m × 10m" },
  { codigo:"PP-3D-01", nome:"Papel de Parede 3D Tijolinhos Branco",       categoria:"papel_de_parede", colecao:"3D",            unidade:"rolo", valor_unitario:"95.00",  status_comercial:"ativo", descricao:"Papel 3D tijolinhos branco, efeito industrial, 0,53m × 10m" },
  // Double Vision
  { codigo:"DV-OP-01", nome:"Persiana Double Vision Opaco Branco",        categoria:"double_vision",   colecao:null,            unidade:"m²",   valor_unitario:"320.00", status_comercial:"ativo", descricao:"Double vision roller duplo, faixa opaca branca, controle de luz" },
  { codigo:"DV-OP-02", nome:"Persiana Double Vision Opaco Cinza",         categoria:"double_vision",   colecao:null,            unidade:"m²",   valor_unitario:"330.00", status_comercial:"ativo", descricao:"Double vision roller duplo, faixa opaca cinza, sofisticado" },
  { codigo:"DV-BK-01", nome:"Persiana Double Vision Blackout Off-White",  categoria:"double_vision",   colecao:null,            unidade:"m²",   valor_unitario:"360.00", status_comercial:"ativo", descricao:"Double vision com camada blackout, off-white" },
  // Mosquiteiro
  { codigo:"MQ-FI-01", nome:"Mosquiteiro Fibra de Vidro Branco",          categoria:"mosquiteiro",     colecao:null,            unidade:"m²",   valor_unitario:"95.00",  status_comercial:"ativo", descricao:"Mosquiteiro fibra de vidro, fixação parede, dobrável" },
  { codigo:"MQ-AL-01", nome:"Mosquiteiro Alumínio Anodizado",             categoria:"mosquiteiro",     colecao:null,            unidade:"m²",   valor_unitario:"145.00", status_comercial:"ativo", descricao:"Mosquiteiro estrutura alumínio anodizado, tela fibra" },
  { codigo:"MQ-RO-01", nome:"Mosquiteiro Rolo (Plissado)",                categoria:"mosquiteiro",     colecao:null,            unidade:"m²",   valor_unitario:"220.00", status_comercial:"ativo", descricao:"Mosquiteiro plissado retrátil, alumínio branco" },
  // Mão de obra novos tipos
  { codigo:"MO-IT",    nome:"Mão de Obra — Instalação Tapete/m²",         categoria:"mao_obra",        colecao:null,            unidade:"m²",   valor_unitario:"25.00",  status_comercial:"ativo", descricao:"Instalação de tapete por m² (corte e ajuste)" },
  { codigo:"MO-IPP",   nome:"Mão de Obra — Instalação Papel de Parede/rolo", categoria:"mao_obra",     colecao:null,            unidade:"rolo", valor_unitario:"40.00",  status_comercial:"ativo", descricao:"Instalação de papel de parede por rolo (cola e aplicação)" },
  { codigo:"MO-IMQ",   nome:"Mão de Obra — Instalação Mosquiteiro",       categoria:"mao_obra",        colecao:null,            unidade:"un",   valor_unitario:"90.00",  status_comercial:"ativo", descricao:"Instalação de mosquiteiro por unidade" },
  { codigo:"MO-IDV",   nome:"Mão de Obra — Instalação Double Vision",     categoria:"mao_obra",        colecao:null,            unidade:"m²",   valor_unitario:"55.00",  status_comercial:"ativo", descricao:"Instalação de persiana double vision por m²" },
];

export async function runDecorExp07Seed(): Promise<{ catalogo: number }> {
  const pool = getPool();
  let catCount = 0;
  try {
    for (const item of CATALOGO_EXP07) {
      await pool.query(
        `INSERT INTO cortiart_catalogo (codigo,nome,categoria,colecao,unidade,valor_unitario,status_comercial,descricao)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`,
        [item.codigo, item.nome, item.categoria, item.colecao ?? null,
         item.unidade, item.valor_unitario, item.status_comercial, item.descricao]
      );
      catCount++;
    }
    console.log(`[DEC-EXP-07 Seed] ${catCount} itens inseridos no catálogo: OK`);
    return { catalogo: catCount };
  } finally {
    await pool.end();
  }
}
