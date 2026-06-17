"""
Arcádia People - Motor de RH (HRM)
Serviço FastAPI para gestão de recursos humanos
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from decimal import Decimal
import json
import os

app = FastAPI(
    title="Arcádia People",
    description="Motor de RH - Folha de Pagamento, Ponto, Férias, eSocial",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========== Tabelas de Cálculo (2024) ==========

TABELA_INSS_2024 = [
    {"faixaInicio": 0, "faixaFim": 1412.00, "aliquota": 7.5},
    {"faixaInicio": 1412.01, "faixaFim": 2666.68, "aliquota": 9.0},
    {"faixaInicio": 2666.69, "faixaFim": 4000.03, "aliquota": 12.0},
    {"faixaInicio": 4000.04, "faixaFim": 7786.02, "aliquota": 14.0},
]

TETO_INSS_2024 = 7786.02
DEDUCAO_DEPENDENTE_IRRF = 189.59

TABELA_IRRF_2024 = [
    {"faixaInicio": 0, "faixaFim": 2259.20, "aliquota": 0, "deducao": 0},
    {"faixaInicio": 2259.21, "faixaFim": 2826.65, "aliquota": 7.5, "deducao": 169.44},
    {"faixaInicio": 2826.66, "faixaFim": 3751.05, "aliquota": 15.0, "deducao": 381.44},
    {"faixaInicio": 3751.06, "faixaFim": 4664.68, "aliquota": 22.5, "deducao": 662.77},
    {"faixaInicio": 4664.69, "faixaFim": 999999999, "aliquota": 27.5, "deducao": 896.00},
]

SALARIO_FAMILIA_2024 = [
    {"faixaFim": 1819.26, "valor": 62.04},
]

# ========== Models ==========

class Funcionario(BaseModel):
    nome: str
    cpf: str
    salario: float
    dataAdmissao: str
    cargoId: Optional[int] = None
    departamentoId: Optional[int] = None
    tipoContrato: str = "clt"
    jornadaTrabalho: str = "44h"

class CalculoFolhaRequest(BaseModel):
    funcionarioId: int
    competencia: str  # YYYY-MM
    salarioBase: float
    diasTrabalhados: int = 30
    horasExtras50: float = 0
    horasExtras100: float = 0
    horasNoturnas: float = 0
    faltas: int = 0
    atrasos: float = 0
    dependentesIrrf: int = 0
    descontosAdicionais: List[Dict[str, Any]] = []
    proventosAdicionais: List[Dict[str, Any]] = []

class CalculoFeriasRequest(BaseModel):
    funcionarioId: int
    salarioBase: float
    diasFerias: int = 30
    diasAbono: int = 0
    mediaHorasExtras: float = 0
    dependentesIrrf: int = 0

class CalculoRescisaoRequest(BaseModel):
    funcionarioId: int
    salarioBase: float
    dataAdmissao: str
    dataDemissao: str
    tipoRescisao: str  # sem_justa_causa, justa_causa, pedido_demissao
    saldoFerias: int = 0
    avisoPrevio: str = "trabalhado"  # trabalhado, indenizado, dispensado
    dependentesIrrf: int = 0

class PontoRequest(BaseModel):
    funcionarioId: int
    data: str
    entrada1: str
    saida1: str
    entrada2: Optional[str] = None
    saida2: Optional[str] = None
    jornadaDiaria: float = 8.0

# ========== Funções de Cálculo ==========

def calcular_inss(salario_bruto: float) -> dict:
    """
    Calcula INSS progressivo (2024) conforme Portaria MPS
    
    Tabela INSS 2024:
    Faixa 1: Até R$ 1.412,00 = 7,5%
    Faixa 2: De R$ 1.412,01 a R$ 2.666,68 = 9%
    Faixa 3: De R$ 2.666,69 a R$ 4.000,03 = 12%
    Faixa 4: De R$ 4.000,04 a R$ 7.786,02 = 14%
    
    Cálculo progressivo: cada faixa incide apenas sobre o valor dentro dela.
    """
    if salario_bruto > TETO_INSS_2024:
        base_calculo = TETO_INSS_2024
    else:
        base_calculo = salario_bruto
    
    inss_total = 0.0
    detalhamento = []
    
    # Limites exatos das faixas para cálculo progressivo
    faixas = [
        {"limite_inferior": 0, "limite_superior": 1412.00, "aliquota": 7.5},
        {"limite_inferior": 1412.00, "limite_superior": 2666.68, "aliquota": 9.0},
        {"limite_inferior": 2666.68, "limite_superior": 4000.03, "aliquota": 12.0},
        {"limite_inferior": 4000.03, "limite_superior": 7786.02, "aliquota": 14.0},
    ]
    
    for i, faixa in enumerate(faixas):
        limite_inferior = faixa["limite_inferior"]
        limite_superior = faixa["limite_superior"]
        aliquota = faixa["aliquota"]
        
        if base_calculo <= limite_inferior:
            break
        
        # Base da faixa: min(salário, limite_superior) - limite_inferior
        teto_faixa = min(base_calculo, limite_superior)
        base_faixa = teto_faixa - limite_inferior
        
        if base_faixa > 0:
            valor_faixa = base_faixa * (aliquota / 100)
            inss_total += valor_faixa
            detalhamento.append({
                "faixa": i + 1,
                "limiteInferior": limite_inferior,
                "limiteSuperior": limite_superior,
                "base": round(base_faixa, 2),
                "aliquota": aliquota,
                "valor": round(valor_faixa, 2)
            })
    
    return {
        "baseCalculo": round(base_calculo, 2),
        "valorInss": round(inss_total, 2),
        "tetoAplicado": salario_bruto > TETO_INSS_2024,
        "detalhamento": detalhamento
    }

def calcular_irrf(base_irrf: float, dependentes: int = 0) -> dict:
    """Calcula IRRF (2024)"""
    deducao_dependentes = dependentes * DEDUCAO_DEPENDENTE_IRRF
    base_calculo = base_irrf - deducao_dependentes
    
    if base_calculo < 0:
        base_calculo = 0
    
    irrf = 0
    aliquota_efetiva = 0
    faixa_aplicada = 0
    
    for i, faixa in enumerate(TABELA_IRRF_2024):
        if base_calculo >= faixa["faixaInicio"] and base_calculo <= faixa["faixaFim"]:
            irrf = (base_calculo * faixa["aliquota"] / 100) - faixa["deducao"]
            aliquota_efetiva = faixa["aliquota"]
            faixa_aplicada = i + 1
            break
    
    if irrf < 0:
        irrf = 0
    
    return {
        "baseCalculo": round(base_calculo, 2),
        "deducaoDependentes": round(deducao_dependentes, 2),
        "aliquotaEfetiva": aliquota_efetiva,
        "faixaAplicada": faixa_aplicada,
        "valorIrrf": round(irrf, 2)
    }

def calcular_fgts(base_fgts: float) -> dict:
    """Calcula FGTS (8%)"""
    valor_fgts = base_fgts * 0.08
    return {
        "baseCalculo": round(base_fgts, 2),
        "aliquota": 8.0,
        "valorFgts": round(valor_fgts, 2)
    }

def calcular_salario_familia(salario: float, filhos_menores: int) -> dict:
    """Calcula Salário Família"""
    valor_cota = 0
    for faixa in SALARIO_FAMILIA_2024:
        if salario <= faixa["faixaFim"]:
            valor_cota = faixa["valor"]
            break
    
    valor_total = valor_cota * filhos_menores
    
    return {
        "salarioBase": round(salario, 2),
        "filhosMenores": filhos_menores,
        "valorCota": valor_cota,
        "valorTotal": round(valor_total, 2),
        "temDireito": valor_cota > 0
    }

def calcular_horas_trabalhadas(entrada1: str, saida1: str, entrada2: str = None, saida2: str = None) -> dict:
    """Calcula horas trabalhadas a partir dos registros de ponto"""
    def time_to_minutes(time_str: str) -> int:
        h, m = map(int, time_str.split(":"))
        return h * 60 + m
    
    minutos_periodo1 = time_to_minutes(saida1) - time_to_minutes(entrada1)
    minutos_periodo2 = 0
    
    if entrada2 and saida2:
        minutos_periodo2 = time_to_minutes(saida2) - time_to_minutes(entrada2)
    
    total_minutos = minutos_periodo1 + minutos_periodo2
    total_horas = total_minutos / 60
    
    return {
        "periodo1": round(minutos_periodo1 / 60, 2),
        "periodo2": round(minutos_periodo2 / 60, 2),
        "totalHoras": round(total_horas, 2),
        "totalMinutos": total_minutos
    }

# ========== Endpoints ==========

@app.get("/")
async def root():
    return {
        "service": "Arcádia People",
        "version": "1.0.0",
        "status": "running",
        "modules": ["funcionarios", "folha", "ferias", "ponto", "beneficios", "esocial"]
    }

@app.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.get("/tabelas/inss")
async def get_tabela_inss():
    """Retorna tabela INSS atual"""
    return {
        "vigencia": "2024",
        "teto": TETO_INSS_2024,
        "faixas": TABELA_INSS_2024
    }

@app.get("/tabelas/irrf")
async def get_tabela_irrf():
    """Retorna tabela IRRF atual"""
    return {
        "vigencia": "2024",
        "deducaoDependente": DEDUCAO_DEPENDENTE_IRRF,
        "faixas": TABELA_IRRF_2024
    }

@app.get("/tabelas/salario-familia")
async def get_tabela_salario_familia():
    """Retorna tabela Salário Família atual"""
    return {
        "vigencia": "2024",
        "faixas": SALARIO_FAMILIA_2024
    }

@app.post("/calcular/inss")
async def calcular_inss_endpoint(salario: float):
    """Calcula INSS para um salário"""
    return calcular_inss(salario)

@app.post("/calcular/irrf")
async def calcular_irrf_endpoint(base: float, dependentes: int = 0):
    """Calcula IRRF para uma base"""
    return calcular_irrf(base, dependentes)

@app.post("/calcular/folha")
async def calcular_folha(request: CalculoFolhaRequest):
    """Calcula folha de pagamento completa para um funcionário"""
    
    # Cálculo do salário proporcional
    salario_proporcional = request.salarioBase * (request.diasTrabalhados / 30)
    
    # Desconto de faltas
    valor_dia = request.salarioBase / 30
    desconto_faltas = valor_dia * request.faltas
    
    # Horas extras
    valor_hora = request.salarioBase / 220  # 220 horas mensais padrão
    valor_he_50 = request.horasExtras50 * (valor_hora * 1.5)
    valor_he_100 = request.horasExtras100 * (valor_hora * 2.0)
    
    # Adicional noturno (20%)
    valor_adicional_noturno = request.horasNoturnas * (valor_hora * 0.2)
    
    # Total de proventos
    proventos_adicionais = sum(p.get("valor", 0) for p in request.proventosAdicionais)
    total_proventos = (
        salario_proporcional + 
        valor_he_50 + 
        valor_he_100 + 
        valor_adicional_noturno +
        proventos_adicionais
    )
    
    # INSS
    inss_calc = calcular_inss(total_proventos)
    valor_inss = inss_calc["valorInss"]
    
    # IRRF (base = bruto - INSS)
    base_irrf = total_proventos - valor_inss
    irrf_calc = calcular_irrf(base_irrf, request.dependentesIrrf)
    valor_irrf = irrf_calc["valorIrrf"]
    
    # FGTS
    fgts_calc = calcular_fgts(total_proventos)
    valor_fgts = fgts_calc["valorFgts"]
    
    # Descontos adicionais
    descontos_adicionais = sum(d.get("valor", 0) for d in request.descontosAdicionais)
    
    # Total de descontos
    total_descontos = valor_inss + valor_irrf + desconto_faltas + descontos_adicionais
    
    # Líquido
    total_liquido = total_proventos - total_descontos
    
    return {
        "funcionarioId": request.funcionarioId,
        "competencia": request.competencia,
        "proventos": {
            "salarioBase": round(request.salarioBase, 2),
            "salarioProporcional": round(salario_proporcional, 2),
            "horasExtras50": {
                "horas": request.horasExtras50,
                "valor": round(valor_he_50, 2)
            },
            "horasExtras100": {
                "horas": request.horasExtras100,
                "valor": round(valor_he_100, 2)
            },
            "adicionalNoturno": {
                "horas": request.horasNoturnas,
                "valor": round(valor_adicional_noturno, 2)
            },
            "adicionais": request.proventosAdicionais,
            "total": round(total_proventos, 2)
        },
        "descontos": {
            "inss": inss_calc,
            "irrf": irrf_calc,
            "faltas": {
                "dias": request.faltas,
                "valor": round(desconto_faltas, 2)
            },
            "adicionais": request.descontosAdicionais,
            "total": round(total_descontos, 2)
        },
        "encargos": {
            "fgts": fgts_calc,
            "inssPatronal": {
                "aliquota": 20.0,
                "valor": round(total_proventos * 0.20, 2)
            }
        },
        "resumo": {
            "totalProventos": round(total_proventos, 2),
            "totalDescontos": round(total_descontos, 2),
            "totalLiquido": round(total_liquido, 2),
            "custoEmpresa": round(total_proventos + valor_fgts + (total_proventos * 0.20), 2)
        }
    }

@app.post("/calcular/ferias")
async def calcular_ferias(request: CalculoFeriasRequest):
    """Calcula férias"""
    
    # Valor base das férias
    valor_ferias = request.salarioBase * (request.diasFerias / 30)
    
    # Adicional de 1/3
    terco_constitucional = valor_ferias / 3
    
    # Abono pecuniário (venda de dias)
    valor_abono = 0
    terco_abono = 0
    if request.diasAbono > 0:
        valor_abono = request.salarioBase * (request.diasAbono / 30)
        terco_abono = valor_abono / 3
    
    # Média de horas extras
    media_he = request.mediaHorasExtras
    
    # Total bruto
    total_bruto = valor_ferias + terco_constitucional + valor_abono + terco_abono + media_he
    
    # INSS sobre férias
    inss_calc = calcular_inss(total_bruto)
    valor_inss = inss_calc["valorInss"]
    
    # IRRF
    base_irrf = total_bruto - valor_inss
    irrf_calc = calcular_irrf(base_irrf, request.dependentesIrrf)
    valor_irrf = irrf_calc["valorIrrf"]
    
    # Líquido
    total_liquido = total_bruto - valor_inss - valor_irrf
    
    return {
        "funcionarioId": request.funcionarioId,
        "diasFerias": request.diasFerias,
        "diasAbono": request.diasAbono,
        "proventos": {
            "ferias": round(valor_ferias, 2),
            "tercoConstitucional": round(terco_constitucional, 2),
            "abonoPecuniario": round(valor_abono, 2),
            "tercoAbono": round(terco_abono, 2),
            "mediaHorasExtras": round(media_he, 2),
            "total": round(total_bruto, 2)
        },
        "descontos": {
            "inss": inss_calc,
            "irrf": irrf_calc,
            "total": round(valor_inss + valor_irrf, 2)
        },
        "resumo": {
            "totalBruto": round(total_bruto, 2),
            "totalDescontos": round(valor_inss + valor_irrf, 2),
            "totalLiquido": round(total_liquido, 2)
        }
    }

@app.post("/calcular/rescisao")
async def calcular_rescisao(request: CalculoRescisaoRequest):
    """Calcula rescisão de contrato de trabalho"""
    from datetime import datetime
    
    data_admissao = datetime.strptime(request.dataAdmissao, "%Y-%m-%d")
    data_demissao = datetime.strptime(request.dataDemissao, "%Y-%m-%d")
    
    # Tempo de serviço
    dias_trabalhados = (data_demissao - data_admissao).days
    meses_trabalhados = dias_trabalhados / 30
    anos_trabalhados = dias_trabalhados / 365
    
    # Saldo de salário (dias do mês da demissão)
    dia_demissao = data_demissao.day
    saldo_salario = request.salarioBase * (dia_demissao / 30)
    
    # 13º proporcional
    meses_13 = data_demissao.month
    decimo_terceiro = (request.salarioBase / 12) * meses_13
    
    # Férias proporcionais + 1/3
    meses_ferias = int(meses_trabalhados % 12)
    if meses_ferias == 0:
        meses_ferias = int(meses_trabalhados)
    ferias_proporcionais = (request.salarioBase / 12) * meses_ferias
    terco_ferias = ferias_proporcionais / 3
    
    # Férias vencidas
    ferias_vencidas = request.salarioBase * (request.saldoFerias / 30)
    terco_vencidas = ferias_vencidas / 3
    
    # Aviso prévio
    aviso_previo = 0
    dias_aviso = 30 + (3 * int(anos_trabalhados))
    if dias_aviso > 90:
        dias_aviso = 90
        
    if request.tipoRescisao == "sem_justa_causa" and request.avisoPrevio == "indenizado":
        aviso_previo = request.salarioBase * (dias_aviso / 30)
    
    # Multa FGTS (40% ou 20%)
    # Estimativa do saldo FGTS (8% do salário * meses)
    saldo_fgts_estimado = (request.salarioBase * 0.08) * meses_trabalhados
    multa_fgts = 0
    
    if request.tipoRescisao == "sem_justa_causa":
        multa_fgts = saldo_fgts_estimado * 0.40
    elif request.tipoRescisao == "acordo":
        multa_fgts = saldo_fgts_estimado * 0.20
    
    # Total bruto
    total_bruto = (
        saldo_salario +
        decimo_terceiro +
        ferias_proporcionais +
        terco_ferias +
        ferias_vencidas +
        terco_vencidas +
        aviso_previo
    )
    
    # Descontos
    inss_calc = calcular_inss(saldo_salario)
    irrf_calc = calcular_irrf(total_bruto - inss_calc["valorInss"], request.dependentesIrrf)
    
    total_descontos = inss_calc["valorInss"] + irrf_calc["valorIrrf"]
    total_liquido = total_bruto - total_descontos + multa_fgts
    
    return {
        "funcionarioId": request.funcionarioId,
        "tipoRescisao": request.tipoRescisao,
        "tempoServico": {
            "dias": dias_trabalhados,
            "meses": round(meses_trabalhados, 1),
            "anos": round(anos_trabalhados, 1)
        },
        "verbas": {
            "saldoSalario": round(saldo_salario, 2),
            "decimoTerceiro": round(decimo_terceiro, 2),
            "feriasProporcionais": round(ferias_proporcionais, 2),
            "tercoFerias": round(terco_ferias, 2),
            "feriasVencidas": round(ferias_vencidas, 2),
            "tercoVencidas": round(terco_vencidas, 2),
            "avisoPrevio": {
                "tipo": request.avisoPrevio,
                "dias": dias_aviso,
                "valor": round(aviso_previo, 2)
            },
            "totalBruto": round(total_bruto, 2)
        },
        "descontos": {
            "inss": inss_calc,
            "irrf": irrf_calc,
            "total": round(total_descontos, 2)
        },
        "fgts": {
            "saldoEstimado": round(saldo_fgts_estimado, 2),
            "multa": round(multa_fgts, 2),
            "percentualMulta": 40 if request.tipoRescisao == "sem_justa_causa" else 20 if request.tipoRescisao == "acordo" else 0
        },
        "resumo": {
            "totalBruto": round(total_bruto, 2),
            "totalDescontos": round(total_descontos, 2),
            "multaFgts": round(multa_fgts, 2),
            "totalLiquido": round(total_liquido, 2)
        }
    }

@app.post("/calcular/ponto")
async def calcular_ponto(request: PontoRequest):
    """Calcula horas trabalhadas e extras"""
    
    horas = calcular_horas_trabalhadas(
        request.entrada1,
        request.saida1,
        request.entrada2,
        request.saida2
    )
    
    jornada_diaria = request.jornadaDiaria
    horas_trabalhadas = horas["totalHoras"]
    
    horas_extras = max(0, horas_trabalhadas - jornada_diaria)
    horas_faltantes = max(0, jornada_diaria - horas_trabalhadas)
    
    # Verificar adicional noturno (22h às 5h)
    horas_noturnas = 0  # Simplificado - precisaria de lógica mais complexa
    
    return {
        "funcionarioId": request.funcionarioId,
        "data": request.data,
        "registros": {
            "entrada1": request.entrada1,
            "saida1": request.saida1,
            "entrada2": request.entrada2,
            "saida2": request.saida2
        },
        "calculo": {
            "jornadaDiaria": jornada_diaria,
            "horasTrabalhadas": round(horas_trabalhadas, 2),
            "horasExtras": round(horas_extras, 2),
            "horasFaltantes": round(horas_faltantes, 2),
            "horasNoturnas": round(horas_noturnas, 2)
        },
        "detalhamento": horas
    }

@app.get("/esocial/eventos")
async def get_eventos_esocial():
    """Lista eventos do eSocial suportados"""
    eventos = [
        {"codigo": "S-1000", "descricao": "Informações do Empregador", "tipo": "tabela"},
        {"codigo": "S-1005", "descricao": "Tabela de Estabelecimentos", "tipo": "tabela"},
        {"codigo": "S-1010", "descricao": "Tabela de Rubricas", "tipo": "tabela"},
        {"codigo": "S-1020", "descricao": "Tabela de Lotações Tributárias", "tipo": "tabela"},
        {"codigo": "S-1030", "descricao": "Tabela de Cargos/Empregos Públicos", "tipo": "tabela"},
        {"codigo": "S-1040", "descricao": "Tabela de Funções/Cargos em Comissão", "tipo": "tabela"},
        {"codigo": "S-1050", "descricao": "Tabela de Horários/Turnos de Trabalho", "tipo": "tabela"},
        {"codigo": "S-1070", "descricao": "Tabela de Processos Administrativos/Judiciais", "tipo": "tabela"},
        {"codigo": "S-2190", "descricao": "Registro Preliminar de Trabalhador", "tipo": "nao_periodico"},
        {"codigo": "S-2200", "descricao": "Cadastramento Inicial / Admissão", "tipo": "nao_periodico"},
        {"codigo": "S-2205", "descricao": "Alteração de Dados Cadastrais", "tipo": "nao_periodico"},
        {"codigo": "S-2206", "descricao": "Alteração de Contrato de Trabalho", "tipo": "nao_periodico"},
        {"codigo": "S-2230", "descricao": "Afastamento Temporário", "tipo": "nao_periodico"},
        {"codigo": "S-2299", "descricao": "Desligamento", "tipo": "nao_periodico"},
        {"codigo": "S-2300", "descricao": "Trabalhador Sem Vínculo - Início", "tipo": "nao_periodico"},
        {"codigo": "S-2306", "descricao": "Trabalhador Sem Vínculo - Alteração", "tipo": "nao_periodico"},
        {"codigo": "S-2399", "descricao": "Trabalhador Sem Vínculo - Término", "tipo": "nao_periodico"},
        {"codigo": "S-1200", "descricao": "Remuneração de Trabalhador", "tipo": "periodico"},
        {"codigo": "S-1210", "descricao": "Pagamentos de Rendimentos", "tipo": "periodico"},
        {"codigo": "S-1260", "descricao": "Comercialização da Produção Rural", "tipo": "periodico"},
        {"codigo": "S-1270", "descricao": "Contratação de Trabalhadores Avulsos", "tipo": "periodico"},
        {"codigo": "S-1280", "descricao": "Informações Complementares aos Eventos Periódicos", "tipo": "periodico"},
        {"codigo": "S-1298", "descricao": "Reabertura dos Eventos Periódicos", "tipo": "periodico"},
        {"codigo": "S-1299", "descricao": "Fechamento dos Eventos Periódicos", "tipo": "periodico"},
    ]
    
    return {
        "eventos": eventos,
        "total": len(eventos)
    }

@app.post("/esocial/gerar-xml/{evento}")
async def gerar_xml_esocial(evento: str, dados: dict):
    """Gera XML para evento do eSocial"""
    # Estrutura básica do XML do eSocial
    xml_estrutura = {
        "evento": evento,
        "versao": "S-1.2",
        "ambiente": dados.get("ambiente", "2"),  # 1=Produção, 2=Homologação
        "dados": dados,
        "status": "estrutura_gerada",
        "observacao": "XML será gerado conforme leiaute oficial do eSocial"
    }
    
    return xml_estrutura

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PEOPLE_PORT", 8004))
    uvicorn.run(app, host="0.0.0.0", port=port)
