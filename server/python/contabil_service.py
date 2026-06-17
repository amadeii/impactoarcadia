"""
Arcádia Contábil - Motor de Contabilidade
Serviço FastAPI para processamento contábil
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal
import json
import os
import re

app = FastAPI(
    title="Arcádia Contábil",
    description="Motor de Contabilidade - DRE, Balanço, Balancete, SPED ECD",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========== Models ==========

class ContaContabil(BaseModel):
    codigo: str
    descricao: str
    tipo: str  # ativo, passivo, patrimonio, receita, despesa
    natureza: str  # devedora, credora
    nivel: int = 1
    contaPai: Optional[int] = None
    aceitaLancamento: bool = True

class Partida(BaseModel):
    contaId: int
    tipo: str  # debito, credito
    valor: float
    historico: Optional[str] = None
    centroCustoId: Optional[int] = None

class Lancamento(BaseModel):
    dataLancamento: str
    dataCompetencia: Optional[str] = None
    tipoDocumento: Optional[str] = None
    numeroDocumento: Optional[str] = None
    historico: str
    partidas: List[Partida]

class PeriodoRequest(BaseModel):
    ano: int
    mes: int
    tenantId: Optional[int] = None

class RelatorioRequest(BaseModel):
    tenantId: Optional[int] = None
    dataInicio: str
    dataFim: str
    centroCustoId: Optional[int] = None

# ========== Plano de Contas Padrão (Simplificado) ==========

PLANO_CONTAS_PADRAO = [
    # ATIVO
    {"codigo": "1", "descricao": "ATIVO", "tipo": "ativo", "natureza": "devedora", "nivel": 1},
    {"codigo": "1.1", "descricao": "ATIVO CIRCULANTE", "tipo": "ativo", "natureza": "devedora", "nivel": 2},
    {"codigo": "1.1.01", "descricao": "Caixa e Equivalentes", "tipo": "ativo", "natureza": "devedora", "nivel": 3},
    {"codigo": "1.1.01.001", "descricao": "Caixa Geral", "tipo": "ativo", "natureza": "devedora", "nivel": 4},
    {"codigo": "1.1.01.002", "descricao": "Bancos Conta Movimento", "tipo": "ativo", "natureza": "devedora", "nivel": 4},
    {"codigo": "1.1.02", "descricao": "Clientes", "tipo": "ativo", "natureza": "devedora", "nivel": 3},
    {"codigo": "1.1.02.001", "descricao": "Duplicatas a Receber", "tipo": "ativo", "natureza": "devedora", "nivel": 4},
    {"codigo": "1.1.03", "descricao": "Estoques", "tipo": "ativo", "natureza": "devedora", "nivel": 3},
    {"codigo": "1.1.03.001", "descricao": "Mercadorias para Revenda", "tipo": "ativo", "natureza": "devedora", "nivel": 4},
    {"codigo": "1.2", "descricao": "ATIVO NÃO CIRCULANTE", "tipo": "ativo", "natureza": "devedora", "nivel": 2},
    {"codigo": "1.2.01", "descricao": "Imobilizado", "tipo": "ativo", "natureza": "devedora", "nivel": 3},
    {"codigo": "1.2.01.001", "descricao": "Máquinas e Equipamentos", "tipo": "ativo", "natureza": "devedora", "nivel": 4},
    {"codigo": "1.2.01.002", "descricao": "Móveis e Utensílios", "tipo": "ativo", "natureza": "devedora", "nivel": 4},
    {"codigo": "1.2.01.003", "descricao": "Veículos", "tipo": "ativo", "natureza": "devedora", "nivel": 4},
    
    # PASSIVO
    {"codigo": "2", "descricao": "PASSIVO", "tipo": "passivo", "natureza": "credora", "nivel": 1},
    {"codigo": "2.1", "descricao": "PASSIVO CIRCULANTE", "tipo": "passivo", "natureza": "credora", "nivel": 2},
    {"codigo": "2.1.01", "descricao": "Fornecedores", "tipo": "passivo", "natureza": "credora", "nivel": 3},
    {"codigo": "2.1.01.001", "descricao": "Fornecedores Nacionais", "tipo": "passivo", "natureza": "credora", "nivel": 4},
    {"codigo": "2.1.02", "descricao": "Obrigações Trabalhistas", "tipo": "passivo", "natureza": "credora", "nivel": 3},
    {"codigo": "2.1.02.001", "descricao": "Salários a Pagar", "tipo": "passivo", "natureza": "credora", "nivel": 4},
    {"codigo": "2.1.02.002", "descricao": "INSS a Recolher", "tipo": "passivo", "natureza": "credora", "nivel": 4},
    {"codigo": "2.1.02.003", "descricao": "FGTS a Recolher", "tipo": "passivo", "natureza": "credora", "nivel": 4},
    {"codigo": "2.1.02.004", "descricao": "IRRF a Recolher", "tipo": "passivo", "natureza": "credora", "nivel": 4},
    {"codigo": "2.1.03", "descricao": "Obrigações Fiscais", "tipo": "passivo", "natureza": "credora", "nivel": 3},
    {"codigo": "2.1.03.001", "descricao": "ICMS a Recolher", "tipo": "passivo", "natureza": "credora", "nivel": 4},
    {"codigo": "2.1.03.002", "descricao": "PIS a Recolher", "tipo": "passivo", "natureza": "credora", "nivel": 4},
    {"codigo": "2.1.03.003", "descricao": "COFINS a Recolher", "tipo": "passivo", "natureza": "credora", "nivel": 4},
    
    # PATRIMÔNIO LÍQUIDO
    {"codigo": "3", "descricao": "PATRIMÔNIO LÍQUIDO", "tipo": "patrimonio", "natureza": "credora", "nivel": 1},
    {"codigo": "3.1", "descricao": "Capital Social", "tipo": "patrimonio", "natureza": "credora", "nivel": 2},
    {"codigo": "3.1.01", "descricao": "Capital Social Integralizado", "tipo": "patrimonio", "natureza": "credora", "nivel": 3},
    {"codigo": "3.2", "descricao": "Lucros ou Prejuízos Acumulados", "tipo": "patrimonio", "natureza": "credora", "nivel": 2},
    {"codigo": "3.2.01", "descricao": "Lucros Acumulados", "tipo": "patrimonio", "natureza": "credora", "nivel": 3},
    {"codigo": "3.2.02", "descricao": "Prejuízos Acumulados", "tipo": "patrimonio", "natureza": "devedora", "nivel": 3},
    
    # RECEITAS
    {"codigo": "4", "descricao": "RECEITAS", "tipo": "receita", "natureza": "credora", "nivel": 1},
    {"codigo": "4.1", "descricao": "Receita Operacional Bruta", "tipo": "receita", "natureza": "credora", "nivel": 2},
    {"codigo": "4.1.01", "descricao": "Vendas de Mercadorias", "tipo": "receita", "natureza": "credora", "nivel": 3},
    {"codigo": "4.1.02", "descricao": "Prestação de Serviços", "tipo": "receita", "natureza": "credora", "nivel": 3},
    {"codigo": "4.2", "descricao": "Deduções da Receita", "tipo": "receita", "natureza": "devedora", "nivel": 2},
    {"codigo": "4.2.01", "descricao": "Devoluções de Vendas", "tipo": "receita", "natureza": "devedora", "nivel": 3},
    {"codigo": "4.2.02", "descricao": "Impostos sobre Vendas", "tipo": "receita", "natureza": "devedora", "nivel": 3},
    
    # DESPESAS
    {"codigo": "5", "descricao": "DESPESAS", "tipo": "despesa", "natureza": "devedora", "nivel": 1},
    {"codigo": "5.1", "descricao": "Custos das Vendas", "tipo": "despesa", "natureza": "devedora", "nivel": 2},
    {"codigo": "5.1.01", "descricao": "CMV - Custo das Mercadorias Vendidas", "tipo": "despesa", "natureza": "devedora", "nivel": 3},
    {"codigo": "5.2", "descricao": "Despesas Operacionais", "tipo": "despesa", "natureza": "devedora", "nivel": 2},
    {"codigo": "5.2.01", "descricao": "Despesas com Pessoal", "tipo": "despesa", "natureza": "devedora", "nivel": 3},
    {"codigo": "5.2.01.001", "descricao": "Salários e Ordenados", "tipo": "despesa", "natureza": "devedora", "nivel": 4},
    {"codigo": "5.2.01.002", "descricao": "INSS Patronal", "tipo": "despesa", "natureza": "devedora", "nivel": 4},
    {"codigo": "5.2.01.003", "descricao": "FGTS", "tipo": "despesa", "natureza": "devedora", "nivel": 4},
    {"codigo": "5.2.02", "descricao": "Despesas Administrativas", "tipo": "despesa", "natureza": "devedora", "nivel": 3},
    {"codigo": "5.2.02.001", "descricao": "Aluguel", "tipo": "despesa", "natureza": "devedora", "nivel": 4},
    {"codigo": "5.2.02.002", "descricao": "Energia Elétrica", "tipo": "despesa", "natureza": "devedora", "nivel": 4},
    {"codigo": "5.2.02.003", "descricao": "Telefone e Internet", "tipo": "despesa", "natureza": "devedora", "nivel": 4},
]

# ========== Endpoints ==========

@app.get("/")
async def root():
    return {
        "service": "Arcádia Contábil",
        "version": "1.0.0",
        "status": "running",
        "modules": ["plano_contas", "lancamentos", "dre", "balanco", "balancete", "sped_ecd"]
    }

@app.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.get("/plano-contas/padrao")
async def get_plano_contas_padrao():
    """Retorna o plano de contas padrão para importação"""
    return {"planoContas": PLANO_CONTAS_PADRAO, "total": len(PLANO_CONTAS_PADRAO)}

@app.post("/validar-lancamento")
async def validar_lancamento(lancamento: Lancamento):
    """Valida se um lançamento está balanceado (débitos = créditos)"""
    total_debitos = sum(p.valor for p in lancamento.partidas if p.tipo == "debito")
    total_creditos = sum(p.valor for p in lancamento.partidas if p.tipo == "credito")
    
    balanceado = abs(total_debitos - total_creditos) < 0.01
    
    return {
        "valido": balanceado,
        "totalDebitos": round(total_debitos, 2),
        "totalCreditos": round(total_creditos, 2),
        "diferenca": round(total_debitos - total_creditos, 2),
        "mensagem": "Lançamento balanceado" if balanceado else "Lançamento desbalanceado"
    }

@app.post("/calcular-dre")
async def calcular_dre(request: RelatorioRequest):
    """Calcula a DRE (Demonstração do Resultado do Exercício)"""
    # Estrutura padrão da DRE
    dre = {
        "periodo": {"inicio": request.dataInicio, "fim": request.dataFim},
        "receitaBruta": 0,
        "deducoes": {
            "devolucoes": 0,
            "impostos": 0,
            "total": 0
        },
        "receitaLiquida": 0,
        "custoVendas": 0,
        "lucroBruto": 0,
        "despesasOperacionais": {
            "vendas": 0,
            "administrativas": 0,
            "pessoal": 0,
            "total": 0
        },
        "resultadoOperacional": 0,
        "receitasFinanceiras": 0,
        "despesasFinanceiras": 0,
        "resultadoAntesIR": 0,
        "provisaoIR": 0,
        "lucroLiquido": 0
    }
    
    return {
        "dre": dre,
        "observacao": "Valores serão calculados com base nos lançamentos do período"
    }

@app.post("/calcular-balanco")
async def calcular_balanco(request: RelatorioRequest):
    """Calcula o Balanço Patrimonial"""
    balanco = {
        "dataBase": request.dataFim,
        "ativo": {
            "circulante": {
                "caixaEquivalentes": 0,
                "contasReceber": 0,
                "estoques": 0,
                "total": 0
            },
            "naoCirculante": {
                "imobilizado": 0,
                "intangivel": 0,
                "total": 0
            },
            "total": 0
        },
        "passivo": {
            "circulante": {
                "fornecedores": 0,
                "obrigacoesTrabalhistas": 0,
                "obrigacoesFiscais": 0,
                "total": 0
            },
            "naoCirculante": {
                "emprestimos": 0,
                "total": 0
            },
            "total": 0
        },
        "patrimonioLiquido": {
            "capitalSocial": 0,
            "reservas": 0,
            "lucrosAcumulados": 0,
            "total": 0
        },
        "totalPassivoPL": 0
    }
    
    return {
        "balanco": balanco,
        "equilibrado": balanco["ativo"]["total"] == balanco["totalPassivoPL"]
    }

@app.post("/calcular-balancete")
async def calcular_balancete(request: PeriodoRequest):
    """Calcula o Balancete de Verificação"""
    balancete = {
        "periodo": {"ano": request.ano, "mes": request.mes},
        "contas": [],
        "totais": {
            "saldoAnteriorDebito": 0,
            "saldoAnteriorCredito": 0,
            "movimentoDebito": 0,
            "movimentoCredito": 0,
            "saldoAtualDebito": 0,
            "saldoAtualCredito": 0
        }
    }
    
    return {"balancete": balancete}

@app.post("/gerar-razao")
async def gerar_razao(request: RelatorioRequest):
    """Gera o Livro Razão para uma conta específica"""
    razao = {
        "periodo": {"inicio": request.dataInicio, "fim": request.dataFim},
        "conta": None,
        "saldoAnterior": 0,
        "lancamentos": [],
        "saldoFinal": 0
    }
    
    return {"razao": razao}

@app.post("/gerar-diario")
async def gerar_diario(request: RelatorioRequest):
    """Gera o Livro Diário"""
    diario = {
        "periodo": {"inicio": request.dataInicio, "fim": request.dataFim},
        "lancamentos": [],
        "totalDebitos": 0,
        "totalCreditos": 0
    }
    
    return {"diario": diario}

@app.get("/tabela-contas-referenciais")
async def get_tabela_contas_referenciais():
    """Retorna a tabela de contas referenciais do SPED ECD"""
    # Tabela simplificada - L100 (Balanço) e L300 (DRE)
    contas_referenciais = {
        "L100": [  # Balanço Patrimonial
            {"codigo": "1", "descricao": "ATIVO TOTAL"},
            {"codigo": "1.01", "descricao": "Ativo Circulante"},
            {"codigo": "1.02", "descricao": "Ativo Não Circulante"},
            {"codigo": "2", "descricao": "PASSIVO TOTAL"},
            {"codigo": "2.01", "descricao": "Passivo Circulante"},
            {"codigo": "2.02", "descricao": "Passivo Não Circulante"},
            {"codigo": "2.03", "descricao": "Patrimônio Líquido"},
        ],
        "L300": [  # DRE
            {"codigo": "3.01", "descricao": "Receita Líquida"},
            {"codigo": "3.02", "descricao": "Custo dos Bens e Serviços Vendidos"},
            {"codigo": "3.03", "descricao": "Resultado Bruto"},
            {"codigo": "3.04", "descricao": "Despesas Operacionais"},
            {"codigo": "3.05", "descricao": "Resultado Antes do IR"},
            {"codigo": "3.06", "descricao": "Lucro Líquido do Exercício"},
        ]
    }
    
    return contas_referenciais

@app.post("/exportar-sped-ecd")
async def exportar_sped_ecd(request: PeriodoRequest):
    """Gera arquivo SPED ECD (Escrituração Contábil Digital)"""
    # Estrutura do arquivo SPED ECD
    sped_ecd = {
        "registro0000": {
            "tipo_escrit": "G",  # G - Livro Diário Geral
            "ind_sit_esp": "0",  # 0 - Normal
            "dt_ini": f"{request.ano}-01-01",
            "dt_fin": f"{request.ano}-12-31",
        },
        "registroI010": {
            "ind_esc": "G",  # G - Diário Geral
        },
        "registroI050": [],  # Plano de Contas
        "registroI150": [],  # Saldos Periódicos
        "registroI200": [],  # Lançamentos
        "registroJ100": [],  # Balanço
        "registroJ150": [],  # DRE
    }
    
    return {
        "status": "estrutura_gerada",
        "arquivo": f"SPED_ECD_{request.ano}.txt",
        "estrutura": sped_ecd,
        "observacao": "Arquivo será gerado com base nos lançamentos contábeis"
    }

# ========== Integrações ==========

@app.post("/integrar-nfe")
async def integrar_nfe(nota: dict):
    """Gera lançamentos contábeis automáticos para NF-e"""
    tipo_operacao = nota.get("tipoOperacao", "saida")
    valor_total = float(nota.get("valorTotal", 0))
    
    if tipo_operacao == "saida":
        lancamento = {
            "historico": f"NF-e {nota.get('numero')} - Venda de mercadorias",
            "partidas": [
                {"conta": "1.1.01.001", "tipo": "debito", "valor": valor_total, "descricao": "Caixa"},
                {"conta": "4.1.01", "tipo": "credito", "valor": valor_total, "descricao": "Vendas"}
            ]
        }
    else:
        lancamento = {
            "historico": f"NF-e {nota.get('numero')} - Compra de mercadorias",
            "partidas": [
                {"conta": "1.1.03.001", "tipo": "debito", "valor": valor_total, "descricao": "Estoques"},
                {"conta": "2.1.01.001", "tipo": "credito", "valor": valor_total, "descricao": "Fornecedores"}
            ]
        }
    
    return {"lancamentoSugerido": lancamento}

@app.post("/integrar-folha")
async def integrar_folha(folha: dict):
    """Gera lançamentos contábeis automáticos para folha de pagamento"""
    total_bruto = float(folha.get("totalBruto", 0))
    total_inss = float(folha.get("totalInss", 0))
    total_irrf = float(folha.get("totalIrrf", 0))
    total_fgts = float(folha.get("totalFgts", 0))
    total_liquido = float(folha.get("totalLiquido", 0))
    
    lancamento = {
        "historico": f"Folha de Pagamento - Competência {folha.get('competencia')}",
        "partidas": [
            {"conta": "5.2.01.001", "tipo": "debito", "valor": total_bruto, "descricao": "Salários e Ordenados"},
            {"conta": "5.2.01.002", "tipo": "debito", "valor": total_inss * 0.2, "descricao": "INSS Patronal"},
            {"conta": "5.2.01.003", "tipo": "debito", "valor": total_fgts, "descricao": "FGTS"},
            {"conta": "2.1.02.001", "tipo": "credito", "valor": total_liquido, "descricao": "Salários a Pagar"},
            {"conta": "2.1.02.002", "tipo": "credito", "valor": total_inss, "descricao": "INSS a Recolher"},
            {"conta": "2.1.02.003", "tipo": "credito", "valor": total_fgts, "descricao": "FGTS a Recolher"},
            {"conta": "2.1.02.004", "tipo": "credito", "valor": total_irrf, "descricao": "IRRF a Recolher"},
        ]
    }
    
    return {"lancamentoSugerido": lancamento}

# ========== Importação de Balanço Patrimonial ==========

class BalancoImportRequest(BaseModel):
    texto: str
    dataBalanco: str
    criarContas: bool = True
    criarAbertura: bool = True

def parse_valor_contabil(valor_str: str) -> tuple:
    """Parseia valor contábil no formato brasileiro (ex: 1.234.567,89D ou 1.234.567,89C)"""
    if not valor_str or valor_str.strip() == "0,00" or valor_str.strip() == "0":
        return 0.0, None
    
    valor_str = valor_str.strip()
    natureza = None
    
    if valor_str.endswith("D"):
        natureza = "devedora"
        valor_str = valor_str[:-1]
    elif valor_str.endswith("C"):
        natureza = "credora"
        valor_str = valor_str[:-1]
    
    valor_str = valor_str.replace(".", "").replace(",", ".").strip()
    
    try:
        valor = float(valor_str)
        return valor, natureza
    except:
        return 0.0, None

def extrair_contas_balanco(texto: str) -> list:
    """Extrai estrutura hierárquica de contas do balanço patrimonial"""
    linhas = texto.split("\n")
    contas = []
    
    nivel_map = {
        "ATIVO": 1, "PASSIVO": 1, "PATRIMÔNIO LÍQUIDO": 1,
        "ATIVO CIRCULANTE": 2, "ATIVO NÃO-CIRCULANTE": 2, "ATIVO NÃO CIRCULANTE": 2,
        "PASSIVO CIRCULANTE": 2, "PASSIVO NÃO-CIRCULANTE": 2, "PASSIVO NÃO CIRCULANTE": 2,
    }
    
    tipo_map = {
        "ATIVO": "ativo", "ATIVO CIRCULANTE": "ativo", "ATIVO NÃO-CIRCULANTE": "ativo",
        "PASSIVO": "passivo", "PASSIVO CIRCULANTE": "passivo", 
        "PATRIMÔNIO LÍQUIDO": "patrimonio", "CAPITAL SOCIAL": "patrimonio",
        "LUCROS OU PREJUÍZOS ACUMULADOS": "patrimonio",
    }
    
    codigo_contador = {"1": 0, "2": 0, "3": 0}
    tipo_atual = "ativo"
    nivel_atual = 1
    codigo_pai = ""
    
    for linha in linhas:
        linha = linha.strip()
        if not linha or "Folha:" in linha or "C.N.P.J" in linha or "Balanço encerrado" in linha:
            continue
        if "BALANÇO PATRIMONIAL" in linha or "Descrição" in linha or "______" in linha:
            continue
        if "Assinado digitalmente" in linha or "SERGIO SZWEC" in linha or "ELOIR" in linha:
            continue
        
        partes = linha.split()
        if len(partes) < 2:
            continue
        
        descricao_partes = []
        valor_2024 = None
        valor_2023 = None
        
        for i, parte in enumerate(partes):
            if any(c.isdigit() for c in parte) and ("," in parte or parte.endswith("D") or parte.endswith("C")):
                valor_2024, natureza = parse_valor_contabil(parte)
                if i + 1 < len(partes):
                    valor_2023, _ = parse_valor_contabil(partes[i + 1])
                break
            else:
                descricao_partes.append(parte)
        
        descricao = " ".join(descricao_partes).strip()
        if not descricao or len(descricao) < 2:
            continue
        
        descricao_upper = descricao.upper()
        
        if descricao_upper in ["ATIVO", "PASSIVO"]:
            tipo_atual = "ativo" if descricao_upper == "ATIVO" else "passivo"
            nivel_atual = 1
            base_codigo = "1" if tipo_atual == "ativo" else "2"
            codigo = base_codigo
        elif "PATRIMÔNIO LÍQUIDO" in descricao_upper:
            tipo_atual = "patrimonio"
            nivel_atual = 1
            codigo = "3"
        elif descricao_upper in nivel_map:
            nivel_atual = nivel_map[descricao_upper]
            if tipo_atual == "ativo":
                codigo = f"1.{codigo_contador['1'] + 1}"
                codigo_contador['1'] += 1
            elif tipo_atual == "passivo":
                codigo = f"2.{codigo_contador['2'] + 1}"
                codigo_contador['2'] += 1
            else:
                codigo = f"3.{codigo_contador['3'] + 1}"
                codigo_contador['3'] += 1
        else:
            espacos = len(linha) - len(linha.lstrip())
            nivel = min(max(espacos // 2, 1), 5)
            if nivel <= 2:
                nivel = 3
            
            base = "1" if tipo_atual == "ativo" else ("2" if tipo_atual == "passivo" else "3")
            codigo_contador[base] = codigo_contador.get(base, 0) + 1
            codigo = f"{base}.{nivel}.{codigo_contador[base]:02d}"
        
        natureza_conta = "devedora" if tipo_atual == "ativo" else "credora"
        if "(-)" in descricao or "DEPRECIAÇÃO" in descricao_upper or "AMORTIZAÇÃO" in descricao_upper:
            natureza_conta = "credora" if tipo_atual == "ativo" else "devedora"
        
        if valor_2024 and valor_2024 > 0:
            contas.append({
                "codigo": codigo,
                "descricao": descricao,
                "tipo": tipo_atual,
                "natureza": natureza_conta,
                "nivel": nivel_atual if descricao_upper in nivel_map else 4,
                "saldo2024": valor_2024,
                "saldo2023": valor_2023 or 0,
                "aceitaLancamento": True
            })
    
    return contas

@app.post("/importar-balanco")
async def importar_balanco(request: BalancoImportRequest):
    """Importa balanço patrimonial e gera plano de contas + lançamentos de abertura"""
    try:
        contas = extrair_contas_balanco(request.texto)
        
        if not contas:
            texto_upper = request.texto.upper()
            has_structure = any(x in texto_upper for x in ["ATIVO", "PASSIVO", "PATRIMÔNIO"])
            has_values = bool(re.search(r'\d{1,3}(?:\.\d{3})*,\d{2}', request.texto))
            
            error_msg = "Não foi possível extrair contas do balanço. "
            if not has_structure:
                error_msg += "O texto não contém estrutura de balanço (ATIVO, PASSIVO, PATRIMÔNIO LÍQUIDO). "
            if not has_values:
                error_msg += "Valores não encontrados no formato brasileiro (ex: 1.234,56). "
            error_msg += "Verifique se o PDF contém os dados do balanço patrimonial."
            
            raise HTTPException(status_code=400, detail=error_msg)
        
        plano_contas = []
        lancamentos_abertura = []
        
        for conta in contas:
            plano_contas.append({
                "codigo": conta["codigo"],
                "descricao": conta["descricao"],
                "tipo": conta["tipo"],
                "natureza": conta["natureza"],
                "nivel": conta["nivel"],
                "aceitaLancamento": conta["aceitaLancamento"],
                "status": "ativo"
            })
            
            if request.criarAbertura and conta.get("saldo2024", 0) > 0:
                tipo_lancamento = "debito" if conta["natureza"] == "devedora" else "credito"
                lancamentos_abertura.append({
                    "conta": conta["codigo"],
                    "descricao": conta["descricao"],
                    "tipo": tipo_lancamento,
                    "valor": conta["saldo2024"],
                    "historico": f"Saldo de abertura - {conta['descricao']}"
                })
        
        total_debito = sum(l["valor"] for l in lancamentos_abertura if l["tipo"] == "debito")
        total_credito = sum(l["valor"] for l in lancamentos_abertura if l["tipo"] == "credito")
        
        return {
            "success": True,
            "planoContas": plano_contas,
            "lancamentosAbertura": lancamentos_abertura,
            "resumo": {
                "totalContas": len(plano_contas),
                "totalLancamentos": len(lancamentos_abertura),
                "totalDebito": total_debito,
                "totalCredito": total_credito,
                "diferenca": abs(total_debito - total_credito)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("CONTABIL_PORT", 8003))
    uvicorn.run(app, host="0.0.0.0", port=port)
