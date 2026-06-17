/**
 * server/control/seeds/ccImpacto.ts
 *
 * Seed dos 100 Centros de Custo série 1100 da Impacto Geologia.
 * Baseado no documento: "Centros de Custo com Bases 1100" (07/05/2026).
 * Idempotente — ON CONFLICT DO NOTHING no código de CC por cliente.
 */
import { db } from "../../db";
import { sql } from "drizzle-orm";

interface CCSeed {
  codigo: string;
  nome: string;
  tipo: "departamento" | "projeto" | "atividade";
  responsavel: string;
  observacoes: string;
  marcaRateio: boolean;
  centroCustoRaiz: boolean;
}

const CCS: CCSeed[] = [
  // BLOCO 1 — Holding e Sócios (1100-1109)
  { codigo:"1100", nome:"Holding - Diretoria Geral",        tipo:"departamento", responsavel:"Diretor Geral",          observacoes:"Centro raiz — holding",                      marcaRateio:false, centroCustoRaiz:true  },
  { codigo:"1101", nome:"Conta Corrente - Sócio A",         tipo:"departamento", responsavel:"Sócio A",                observacoes:"Adiantamentos, pró-labore, distribuição",    marcaRateio:false, centroCustoRaiz:false },
  { codigo:"1102", nome:"Conta Corrente - Sócio B",         tipo:"departamento", responsavel:"Sócio B",                observacoes:"Adiantamentos, pró-labore, distribuição",    marcaRateio:false, centroCustoRaiz:false },
  { codigo:"1103", nome:"Conta Corrente - Sócio C",         tipo:"departamento", responsavel:"Sócio C",                observacoes:"Adiantamentos, pró-labore, distribuição",    marcaRateio:false, centroCustoRaiz:false },
  { codigo:"1104", nome:"Reserva Estratégica",              tipo:"departamento", responsavel:"CFO",                    observacoes:"Fundo para contingências e investimentos",   marcaRateio:false, centroCustoRaiz:false },
  { codigo:"1105", nome:"Pró-labore Diretoria",             tipo:"departamento", responsavel:"Diretor Geral",          observacoes:"Salários e bônus da diretoria",              marcaRateio:false, centroCustoRaiz:false },
  { codigo:"1106", nome:"Despesas de Representação",        tipo:"departamento", responsavel:"Diretor Geral",          observacoes:"Viagens, hospedagens, eventos da diretoria", marcaRateio:false, centroCustoRaiz:false },
  { codigo:"1107", nome:"Consultoria Estratégica",          tipo:"departamento", responsavel:"CFO",                    observacoes:"Consultores externos, assessoria",           marcaRateio:false, centroCustoRaiz:false },
  { codigo:"1108", nome:"Conformidade e Compliance",        tipo:"departamento", responsavel:"Diretor Geral",          observacoes:"Auditoria interna, conformidade",            marcaRateio:false, centroCustoRaiz:false },
  { codigo:"1109", nome:"Reservado para Expansão",          tipo:"departamento", responsavel:"",                       observacoes:"Disponível para futuros centros",            marcaRateio:false, centroCustoRaiz:false },

  // BLOCO 2 — Administração Corporativa (1110-1119) — RATEIO
  { codigo:"1110", nome:"Administração Central",            tipo:"departamento", responsavel:"Gerente Administrativo", observacoes:"Centro raiz — administração compartilhada",  marcaRateio:true,  centroCustoRaiz:true  },
  { codigo:"1111", nome:"Gestão de Processos",              tipo:"departamento", responsavel:"Gerente Administrativo", observacoes:"Documentação, procedimentos, qualidade",    marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1112", nome:"Gestão de Contratos",              tipo:"departamento", responsavel:"Gerente Administrativo", observacoes:"Negociação e gestão de contratos",          marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1113", nome:"Secretaria Executiva",             tipo:"departamento", responsavel:"Assistente Executivo",   observacoes:"Suporte administrativo, agenda",            marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1114", nome:"Recepção e Atendimento",           tipo:"departamento", responsavel:"Recepcionista",          observacoes:"Atendimento ao cliente, visitantes",        marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1115", nome:"Arquivo e Documentação",           tipo:"departamento", responsavel:"Arquivista",             observacoes:"Gestão de documentos, arquivo físico",      marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1116", nome:"Segurança Física",                 tipo:"departamento", responsavel:"Gerente de Segurança",   observacoes:"Vigilância, controle de acesso, CFTV",     marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1117", nome:"Gestão de Riscos",                 tipo:"departamento", responsavel:"Gerente de Riscos",      observacoes:"Análise de riscos, seguros, contingência",  marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1118", nome:"Qualidade e Certificações",        tipo:"departamento", responsavel:"Gerente de Qualidade",   observacoes:"ISO, certificações, auditorias",            marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1119", nome:"Reservado para Expansão",          tipo:"departamento", responsavel:"",                       observacoes:"Disponível para futuros centros",            marcaRateio:false, centroCustoRaiz:false },

  // BLOCO 3 — Financeiro e Contábil (1120-1129) — RATEIO
  { codigo:"1120", nome:"Financeiro / Contábil",            tipo:"departamento", responsavel:"Gerente Financeiro",     observacoes:"Centro raiz — finanças",                    marcaRateio:true,  centroCustoRaiz:true  },
  { codigo:"1121", nome:"Contabilidade Geral",              tipo:"departamento", responsavel:"Contador",               observacoes:"Lançamentos, balancete, demonstrações",     marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1122", nome:"Contabilidade Gerencial",          tipo:"departamento", responsavel:"Analista Contábil",      observacoes:"Análise de custos, rentabilidade",          marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1123", nome:"Auditoria e Conformidade",         tipo:"departamento", responsavel:"Auditor",                observacoes:"Auditoria interna e externa",                marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1124", nome:"Tesouraria",                       tipo:"departamento", responsavel:"Tesoureiro",             observacoes:"Gestão de caixa, bancos, aplicações",       marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1125", nome:"Contas a Pagar",                   tipo:"departamento", responsavel:"Analista Financeiro",    observacoes:"Gestão de fornecedores, pagamentos",        marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1126", nome:"Contas a Receber",                 tipo:"departamento", responsavel:"Analista Financeiro",    observacoes:"Gestão de clientes, recebimentos",          marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1127", nome:"Impostos e Tributos",              tipo:"departamento", responsavel:"Especialista Fiscal",    observacoes:"Apuração de impostos, retenções",           marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1128", nome:"Planejamento Orçamentário",        tipo:"departamento", responsavel:"Analista Orçamentário",  observacoes:"Orçamento, previsões, análise de variações",marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1129", nome:"Reservado para Expansão",          tipo:"departamento", responsavel:"",                       observacoes:"Disponível para futuros centros",            marcaRateio:false, centroCustoRaiz:false },

  // BLOCO 4 — Recursos Humanos (1130-1139) — RATEIO
  { codigo:"1130", nome:"Recursos Humanos",                 tipo:"departamento", responsavel:"Gerente RH",             observacoes:"Centro raiz — RH compartilhado",            marcaRateio:true,  centroCustoRaiz:true  },
  { codigo:"1131", nome:"Recrutamento e Seleção",           tipo:"departamento", responsavel:"Especialista RH",        observacoes:"Contratação, entrevistas, onboarding",      marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1132", nome:"Treinamento e Desenvolvimento",    tipo:"departamento", responsavel:"Especialista RH",        observacoes:"Cursos, capacitação, desenvolvimento",      marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1133", nome:"Folha de Pagamento",               tipo:"departamento", responsavel:"Analista RH",            observacoes:"Cálculo, processamento, dissídios",         marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1134", nome:"Benefícios e Encargos",            tipo:"departamento", responsavel:"Analista RH",            observacoes:"VR, VT, saúde, FGTS",                       marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1135", nome:"Relações Trabalhistas",            tipo:"departamento", responsavel:"Especialista RH",        observacoes:"Negociações, acordos, rescisões",           marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1136", nome:"Saúde e Segurança",                tipo:"departamento", responsavel:"Especialista SST",       observacoes:"NR, PPRA, PCMSO, exames ocupacionais",     marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1137", nome:"Cultura e Clima",                  tipo:"departamento", responsavel:"Especialista RH",        observacoes:"Eventos, integração, pesquisa de clima",    marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1138", nome:"Folha de Terceirizados",           tipo:"departamento", responsavel:"Analista RH",            observacoes:"Gestão de prestadores de serviço",          marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1139", nome:"Reservado para Expansão",          tipo:"departamento", responsavel:"",                       observacoes:"Disponível para futuros centros",            marcaRateio:false, centroCustoRaiz:false },

  // BLOCO 5 — TI e Infraestrutura (1140-1149) — RATEIO
  { codigo:"1140", nome:"TI e Infraestrutura",              tipo:"departamento", responsavel:"Gerente TI",             observacoes:"Centro raiz — TI compartilhada",            marcaRateio:true,  centroCustoRaiz:true  },
  { codigo:"1141", nome:"Desenvolvimento de Sistemas",      tipo:"departamento", responsavel:"Desenvolvedor",          observacoes:"Customizações, novos módulos",               marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1142", nome:"Suporte Técnico",                  tipo:"departamento", responsavel:"Técnico TI",             observacoes:"Help desk, suporte ao usuário",             marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1143", nome:"Infraestrutura de Rede",           tipo:"departamento", responsavel:"Administrador Rede",     observacoes:"Servidores, roteadores, switches",          marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1144", nome:"Segurança da Informação",          tipo:"departamento", responsavel:"Especialista Segurança", observacoes:"Firewalls, antivírus, backups",             marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1145", nome:"Licenças de Software",             tipo:"departamento", responsavel:"Gerente TI",             observacoes:"Arcádia Suite, Office, antivírus",          marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1146", nome:"Internet e Telefonia",             tipo:"departamento", responsavel:"Gerente TI",             observacoes:"Banda larga, telefone, celulares",          marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1147", nome:"Computadores e Periféricos",       tipo:"departamento", responsavel:"Técnico TI",             observacoes:"Compra, manutenção, descarte",              marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1148", nome:"Dados e Backup",                   tipo:"departamento", responsavel:"Administrador BD",       observacoes:"Backup, recuperação, disaster recovery",    marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1149", nome:"Reservado para Expansão",          tipo:"departamento", responsavel:"",                       observacoes:"Disponível para futuros centros",            marcaRateio:false, centroCustoRaiz:false },

  // BLOCO 6 — Marketing e Comercial (1150-1159) — RATEIO
  { codigo:"1150", nome:"Marketing e Comercial",            tipo:"departamento", responsavel:"Gerente Comercial",      observacoes:"Centro raiz — marketing",                   marcaRateio:true,  centroCustoRaiz:true  },
  { codigo:"1151", nome:"Publicidade e Propaganda",         tipo:"departamento", responsavel:"Especialista Marketing", observacoes:"Anúncios, campanhas, redes sociais",        marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1152", nome:"Eventos e Feiras",                 tipo:"departamento", responsavel:"Especialista Marketing", observacoes:"Participação em eventos, stands",           marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1153", nome:"Materiais Promocionais",           tipo:"departamento", responsavel:"Especialista Marketing", observacoes:"Brochuras, banners, camisetas",             marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1154", nome:"Comissões de Vendas",              tipo:"departamento", responsavel:"Gerente Comercial",      observacoes:"Comissões de representantes",               marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1155", nome:"Prospecção de Clientes",           tipo:"departamento", responsavel:"Vendedor",               observacoes:"Viagens de vendas, prospecção",             marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1156", nome:"Relacionamento com Cliente",       tipo:"departamento", responsavel:"Gerente Comercial",      observacoes:"Atendimento, satisfação, retenção",         marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1157", nome:"Pesquisa de Mercado",              tipo:"departamento", responsavel:"Analista Comercial",     observacoes:"Estudos de mercado, concorrência",          marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1158", nome:"Parcerias e Alianças",             tipo:"departamento", responsavel:"Gerente Comercial",      observacoes:"Desenvolvimento de parcerias estratégicas", marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1159", nome:"Reservado para Expansão",          tipo:"departamento", responsavel:"",                       observacoes:"Disponível para futuros centros",            marcaRateio:false, centroCustoRaiz:false },

  // BLOCO 7 — Facilities e Patrimônio (1160-1169) — RATEIO
  { codigo:"1160", nome:"Facilities / Patrimônio",          tipo:"departamento", responsavel:"Gerente Facilities",     observacoes:"Centro raiz — facilities",                  marcaRateio:true,  centroCustoRaiz:true  },
  { codigo:"1161", nome:"Aluguel de Imóvel",                tipo:"departamento", responsavel:"Gerente Facilities",     observacoes:"Aluguel da sede, filiais, depósitos",       marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1162", nome:"Energia Elétrica",                 tipo:"departamento", responsavel:"Gerente Facilities",     observacoes:"Conta de luz, geradores, painéis solares",  marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1163", nome:"Água e Esgoto",                    tipo:"departamento", responsavel:"Gerente Facilities",     observacoes:"Conta de água, tratamento, reuso",          marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1164", nome:"Telefone e Internet",              tipo:"departamento", responsavel:"Gerente Facilities",     observacoes:"Telefone fixo, internet compartilhada",     marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1165", nome:"Limpeza e Higiene",                tipo:"departamento", responsavel:"Gerente Facilities",     observacoes:"Limpeza predial, higiene, sanitários",      marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1166", nome:"Manutenção Predial",               tipo:"departamento", responsavel:"Gerente Facilities",     observacoes:"Reparos, pintura, hidráulica, elétrica",    marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1167", nome:"Segurança Predial",                tipo:"departamento", responsavel:"Gerente Facilities",     observacoes:"Vigilância, alarme, controle de acesso",    marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1168", nome:"Paisagismo e Áreas Externas",      tipo:"departamento", responsavel:"Gerente Facilities",     observacoes:"Jardinagem, limpeza de áreas comuns",       marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1169", nome:"Reservado para Expansão",          tipo:"departamento", responsavel:"",                       observacoes:"Disponível para futuros centros",            marcaRateio:false, centroCustoRaiz:false },

  // BLOCO 8 — Operações - Projetos (1170-1179)
  { codigo:"1170", nome:"Operações - Projetos",             tipo:"departamento", responsavel:"Gerente de Projetos",    observacoes:"Centro raiz — projetos",                    marcaRateio:false, centroCustoRaiz:true  },
  { codigo:"1171", nome:"Licenciamento Ambiental",          tipo:"projeto",      responsavel:"Coord. Licenciamento",  observacoes:"Projetos de licenciamento, consultoria",    marcaRateio:false, centroCustoRaiz:false },
  { codigo:"1172", nome:"Diagnóstico de Áreas",             tipo:"projeto",      responsavel:"Coord. Diagnóstico",    observacoes:"Investigações ambientais, mapeamento",      marcaRateio:false, centroCustoRaiz:false },
  { codigo:"1173", nome:"Remediação Ambiental",             tipo:"projeto",      responsavel:"Coord. Remediação",     observacoes:"Limpeza e remediação de solos e águas",     marcaRateio:false, centroCustoRaiz:false },
  { codigo:"1174", nome:"Monitoramento Ambiental",          tipo:"projeto",      responsavel:"Coord. Monitoramento",  observacoes:"Monitoramento contínuo, relatórios",        marcaRateio:false, centroCustoRaiz:false },
  { codigo:"1175", nome:"Consultoria Ambiental",            tipo:"projeto",      responsavel:"Consultor Sênior",      observacoes:"Assessoria técnica, pareceres",             marcaRateio:false, centroCustoRaiz:false },
  { codigo:"1176", nome:"Gestão de Projetos",               tipo:"projeto",      responsavel:"Gerente de Projetos",   observacoes:"Planejamento, execução, controle",          marcaRateio:false, centroCustoRaiz:false },
  { codigo:"1177", nome:"Equipe Técnica de Campo",          tipo:"atividade",    responsavel:"Supervisor de Campo",   observacoes:"Operações em campo, coleta de amostras",    marcaRateio:false, centroCustoRaiz:false },
  { codigo:"1178", nome:"Pesquisa e Desenvolvimento",       tipo:"projeto",      responsavel:"Pesquisador",           observacoes:"Inovação, novos métodos, estudos",          marcaRateio:false, centroCustoRaiz:false },
  { codigo:"1179", nome:"Reservado para Expansão",          tipo:"projeto",      responsavel:"",                      observacoes:"Disponível para futuros centros",            marcaRateio:false, centroCustoRaiz:false },

  // BLOCO 9 — Laboratório (1180-1189)
  { codigo:"1180", nome:"Laboratório / Análises",           tipo:"departamento", responsavel:"Gerente Laboratório",   observacoes:"Centro raiz — laboratório",                 marcaRateio:false, centroCustoRaiz:true  },
  { codigo:"1181", nome:"Análises Físico-Químicas",         tipo:"atividade",    responsavel:"Técnico Laboratorial",  observacoes:"Análises de solo, água, ar",                marcaRateio:false, centroCustoRaiz:false },
  { codigo:"1182", nome:"Equipamentos de Laboratório",      tipo:"atividade",    responsavel:"Técnico Laboratorial",  observacoes:"Manutenção, calibração de equipamentos",    marcaRateio:false, centroCustoRaiz:false },
  { codigo:"1183", nome:"Reagentes e Consumíveis",          tipo:"atividade",    responsavel:"Almoxarife",            observacoes:"Compra de reagentes, consumíveis",          marcaRateio:false, centroCustoRaiz:false },
  { codigo:"1184", nome:"Controle de Qualidade",            tipo:"atividade",    responsavel:"Analista QA",           observacoes:"Validação de resultados, certificações",    marcaRateio:false, centroCustoRaiz:false },
  { codigo:"1185", nome:"Gestão de Resíduos",               tipo:"atividade",    responsavel:"Gerente Laboratório",   observacoes:"Descarte seguro de resíduos químicos",      marcaRateio:false, centroCustoRaiz:false },
  { codigo:"1186", nome:"Acreditação e Certificações",      tipo:"atividade",    responsavel:"Gerente Laboratório",   observacoes:"ISO 17025, acreditações, auditorias",       marcaRateio:false, centroCustoRaiz:false },
  { codigo:"1187", nome:"Almoxarifado Técnico",             tipo:"atividade",    responsavel:"Almoxarife",            observacoes:"Estoque de materiais, ferramentas, EPIs",   marcaRateio:false, centroCustoRaiz:false },
  { codigo:"1188", nome:"Segurança Laboratorial",           tipo:"atividade",    responsavel:"Especialista SST",      observacoes:"EPI, treinamento, protocolos de segurança", marcaRateio:false, centroCustoRaiz:false },
  { codigo:"1189", nome:"Reservado para Expansão",          tipo:"atividade",    responsavel:"",                      observacoes:"Disponível para futuros centros",            marcaRateio:false, centroCustoRaiz:false },

  // BLOCO 10 — Frotas e Ativos (1190-1199) — RATEIO
  { codigo:"1190", nome:"Frotas e Ativos",                  tipo:"departamento", responsavel:"Gerente de Frotas",     observacoes:"Centro raiz — frotas",                      marcaRateio:true,  centroCustoRaiz:true  },
  { codigo:"1191", nome:"Veículo Leve 01",                  tipo:"atividade",    responsavel:"Motorista/Operador",    observacoes:"Placa: ABC-1234 — combustível, manutenção", marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1192", nome:"Veículo Leve 02",                  tipo:"atividade",    responsavel:"Motorista/Operador",    observacoes:"Placa: DEF-5678 — combustível, manutenção", marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1193", nome:"Veículo Leve 03",                  tipo:"atividade",    responsavel:"Motorista/Operador",    observacoes:"Placa: GHI-9012 — combustível, manutenção", marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1194", nome:"Máquina de Perfuração 01",         tipo:"atividade",    responsavel:"Operador/Manutenção",   observacoes:"Manutenção, combustível, peças",            marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1195", nome:"Máquina de Perfuração 02",         tipo:"atividade",    responsavel:"Operador/Manutenção",   observacoes:"Manutenção, combustível, peças",            marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1196", nome:"Equipamento de Sondagem 01",       tipo:"atividade",    responsavel:"Operador/Manutenção",   observacoes:"Manutenção, calibração, peças",             marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1197", nome:"Equipamento de Sondagem 02",       tipo:"atividade",    responsavel:"Operador/Manutenção",   observacoes:"Manutenção, calibração, peças",             marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1198", nome:"Oficina e Manutenção Central",     tipo:"atividade",    responsavel:"Mecânico",              observacoes:"Manutenção centralizada de frotas",         marcaRateio:true,  centroCustoRaiz:false },
  { codigo:"1199", nome:"Reservado para Expansão",          tipo:"atividade",    responsavel:"",                      observacoes:"Disponível para futuros centros",            marcaRateio:false, centroCustoRaiz:false },
];

export async function seedCCsImpacto(clienteId: string, tenantId: string): Promise<{
  created: number; skipped: number; total: number;
}> {
  const existing = await db.execute(
    sql`SELECT codigo FROM centros_custo WHERE cliente_id = ${clienteId} AND tenant_id = ${tenantId}`
  );
  const existingSet = new Set((existing.rows ?? existing as any).map((r: any) => r.codigo));

  let created = 0;
  let skipped = 0;

  for (const cc of CCS) {
    if (existingSet.has(cc.codigo)) { skipped++; continue; }

    await db.execute(sql`
      INSERT INTO centros_custo
        (id, tenant_id, cliente_id, codigo, nome, tipo, responsavel,
         descricao, marca_rateio, centro_custo_raiz, ativo)
      VALUES (
        gen_random_uuid(), ${tenantId}, ${clienteId},
        ${cc.codigo}, ${cc.nome}, ${cc.tipo}, ${cc.responsavel},
        ${cc.observacoes}, ${cc.marcaRateio}, ${cc.centroCustoRaiz}, true
      )
    `);
    created++;
  }

  return { created, skipped, total: CCS.length };
}
