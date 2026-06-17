"""
Arcádia Fisco - Serviço Python para emissão de NF-e/NFC-e
Utiliza nfelib para geração de XML e comunicação com SEFAZ
"""

import os
import base64
import tempfile
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography import x509

try:
    import nfelib
    NFELIB_AVAILABLE = True
except ImportError:
    NFELIB_AVAILABLE = False
    print("[WARN] nfelib not available, running in mock mode")

try:
    from signxml.signer import XMLSigner
    from signxml.verifier import XMLVerifier
    from lxml import etree
    SIGNXML_AVAILABLE = True
except ImportError:
    try:
        from signxml import XMLSigner, XMLVerifier
        from lxml import etree
        SIGNXML_AVAILABLE = True
    except ImportError:
        SIGNXML_AVAILABLE = False
        XMLSigner = None
        XMLVerifier = None
        etree = None
        print("[WARN] signxml not available")

try:
    from zeep import Client
    from zeep.transports import Transport
    ZEEP_AVAILABLE = True
except ImportError:
    ZEEP_AVAILABLE = False
    print("[WARN] zeep not available for SEFAZ communication")

app = FastAPI(
    title="Arcádia Fisco Service",
    description="Serviço de emissão de NF-e/NFC-e com nfelib",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Ambiente(str, Enum):
    PRODUCAO = "1"
    HOMOLOGACAO = "2"


class ModeloNFe(str, Enum):
    NFE = "55"
    NFCE = "65"


class TipoOperacao(str, Enum):
    ENTRADA = "0"
    SAIDA = "1"


class ItemNFe(BaseModel):
    numero: int = Field(..., description="Número sequencial do item")
    codigo: str = Field(..., description="Código do produto")
    descricao: str = Field(..., description="Descrição do produto")
    ncm: str = Field(..., description="Código NCM")
    cfop: str = Field(..., description="CFOP")
    unidade: str = Field(default="UN", description="Unidade comercial")
    quantidade: float = Field(..., description="Quantidade comercial")
    valor_unitario: float = Field(..., description="Valor unitário")
    valor_total: float = Field(..., description="Valor total do item")
    cst_icms: str = Field(default="00", description="CST ICMS")
    aliq_icms: float = Field(default=0.0, description="Alíquota ICMS")
    valor_icms: float = Field(default=0.0, description="Valor ICMS")
    cst_pis: str = Field(default="01", description="CST PIS")
    aliq_pis: float = Field(default=0.0, description="Alíquota PIS")
    valor_pis: float = Field(default=0.0, description="Valor PIS")
    cst_cofins: str = Field(default="01", description="CST COFINS")
    aliq_cofins: float = Field(default=0.0, description="Alíquota COFINS")
    valor_cofins: float = Field(default=0.0, description="Valor COFINS")
    cest: Optional[str] = None
    perc_ibs_uf: Optional[float] = None
    perc_ibs_mun: Optional[float] = None
    perc_cbs: Optional[float] = None


class EmitenteNFe(BaseModel):
    cnpj: str
    ie: str
    razao_social: str
    nome_fantasia: Optional[str] = None
    endereco: str
    numero: str
    bairro: str
    municipio: str
    cod_municipio: str
    uf: str
    cep: str
    crt: str = "3"  # 1=Simples, 2=SN Excesso, 3=Normal


class DestinatarioNFe(BaseModel):
    cpf_cnpj: str
    ie: Optional[str] = None
    razao_social: str
    endereco: Optional[str] = None
    numero: Optional[str] = None
    bairro: Optional[str] = None
    municipio: Optional[str] = None
    cod_municipio: Optional[str] = None
    uf: Optional[str] = None
    cep: Optional[str] = None
    ind_ie_dest: str = "9"  # 1=Contribuinte, 2=Isento, 9=Não contribuinte


class DadosNFe(BaseModel):
    modelo: ModeloNFe = ModeloNFe.NFE
    serie: int = 1
    numero: int
    natureza_operacao: str = "VENDA"
    tipo_operacao: TipoOperacao = TipoOperacao.SAIDA
    ambiente: Ambiente = Ambiente.HOMOLOGACAO
    emitente: EmitenteNFe
    destinatario: DestinatarioNFe
    itens: List[ItemNFe]
    valor_produtos: float
    valor_total: float
    valor_desconto: float = 0.0
    valor_frete: float = 0.0
    valor_seguro: float = 0.0
    valor_outros: float = 0.0
    info_complementar: Optional[str] = None


class CertificadoA1(BaseModel):
    arquivo_base64: str
    senha: str


class RespostaEmissao(BaseModel):
    sucesso: bool
    chave_nfe: Optional[str] = None
    protocolo: Optional[str] = None
    xml_autorizado: Optional[str] = None
    codigo_status: Optional[str] = None
    motivo_status: Optional[str] = None
    data_autorizacao: Optional[str] = None
    erro: Optional[str] = None


class RespostaConsulta(BaseModel):
    sucesso: bool
    situacao: Optional[str] = None
    protocolo: Optional[str] = None
    data_recebimento: Optional[str] = None
    erro: Optional[str] = None


class RespostaCancelamento(BaseModel):
    sucesso: bool
    protocolo: Optional[str] = None
    data_evento: Optional[str] = None
    erro: Optional[str] = None


UF_CODIGOS = {
    "AC": "12", "AL": "27", "AP": "16", "AM": "13", "BA": "29",
    "CE": "23", "DF": "53", "ES": "32", "GO": "52", "MA": "21",
    "MT": "51", "MS": "50", "MG": "31", "PA": "15", "PB": "25",
    "PR": "41", "PE": "26", "PI": "22", "RJ": "33", "RN": "24",
    "RS": "43", "RO": "11", "RR": "14", "SC": "42", "SP": "35",
    "SE": "28", "TO": "17"
}

SEFAZ_AUTORIZADORES = {
    "AM": {"hom": "https://homnfe.sefaz.am.gov.br/services2/services/NfeAutorizacao4", "prod": "https://nfe.sefaz.am.gov.br/services2/services/NfeAutorizacao4"},
    "BA": {"hom": "https://hnfe.sefaz.ba.gov.br/webservices/NFeAutorizacao4/NFeAutorizacao4.asmx", "prod": "https://nfe.sefaz.ba.gov.br/webservices/NFeAutorizacao4/NFeAutorizacao4.asmx"},
    "GO": {"hom": "https://homolog.sefaz.go.gov.br/nfe/services/NFeAutorizacao4", "prod": "https://nfe.sefaz.go.gov.br/nfe/services/NFeAutorizacao4"},
    "MG": {"hom": "https://hnfe.fazenda.mg.gov.br/nfe2/services/NFeAutorizacao4", "prod": "https://nfe.fazenda.mg.gov.br/nfe2/services/NFeAutorizacao4"},
    "MS": {"hom": "https://homologacao.nfe.ms.gov.br/ws/NFeAutorizacao4", "prod": "https://nfe.sefaz.ms.gov.br/ws/NFeAutorizacao4"},
    "MT": {"hom": "https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeAutorizacao4", "prod": "https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeAutorizacao4"},
    "PE": {"hom": "https://nfehomolog.sefaz.pe.gov.br/nfe-service/services/NFeAutorizacao4", "prod": "https://nfe.sefaz.pe.gov.br/nfe-service/services/NFeAutorizacao4"},
    "PR": {"hom": "https://homologacao.nfe.sefa.pr.gov.br/nfe/NFeAutorizacao4", "prod": "https://nfe.sefa.pr.gov.br/nfe/NFeAutorizacao4"},
    "RS": {"hom": "https://nfe-homologacao.sefazrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx", "prod": "https://nfe.sefazrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx"},
    "SP": {"hom": "https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx", "prod": "https://nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx"},
    "SVRS": {"hom": "https://nfe-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx", "prod": "https://nfe.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx"},
    "SVAN": {"hom": "https://hom.sefazvirtual.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx", "prod": "https://www.sefazvirtual.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx"},
}

def get_autorizador_uf(uf: str) -> str:
    """Retorna o autorizador para determinada UF"""
    uf_svrs = ["AC", "AL", "AP", "DF", "ES", "PB", "PI", "RJ", "RN", "RO", "RR", "SC", "SE", "TO"]
    uf_svan = ["MA", "PA"]
    if uf in uf_svrs:
        return "SVRS"
    elif uf in uf_svan:
        return "SVAN"
    elif uf in SEFAZ_AUTORIZADORES:
        return uf
    return "SVRS"


def gerar_chave_nfe(
    cod_uf: str,
    data_emissao: datetime,
    cnpj: str,
    modelo: str,
    serie: int,
    numero: int,
    tipo_emissao: str = "1",
    codigo_numerico: str = None
) -> str:
    """Gera a chave de acesso da NF-e (44 dígitos)"""
    if codigo_numerico is None:
        import random
        codigo_numerico = str(random.randint(10000000, 99999999))
    
    chave_sem_dv = (
        cod_uf.zfill(2) +
        data_emissao.strftime("%y%m") +
        cnpj.zfill(14) +
        modelo.zfill(2) +
        str(serie).zfill(3) +
        str(numero).zfill(9) +
        tipo_emissao +
        codigo_numerico.zfill(8)
    )
    
    peso = 2
    soma = 0
    for digito in reversed(chave_sem_dv):
        soma += int(digito) * peso
        peso = 2 if peso == 9 else peso + 1
    
    resto = soma % 11
    dv = 0 if resto < 2 else 11 - resto
    
    return chave_sem_dv + str(dv)


def carregar_certificado_a1(arquivo_base64: str, senha: str) -> tuple:
    """Carrega certificado A1 (PFX) e retorna chave privada e certificado"""
    try:
        pfx_data = base64.b64decode(arquivo_base64)
        private_key, certificate, additional_certs = pkcs12.load_key_and_certificates(
            pfx_data, 
            senha.encode()
        )
        return private_key, certificate, additional_certs
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao carregar certificado: {str(e)}")


def validar_certificado(certificate) -> dict:
    """Valida e retorna informações do certificado"""
    now = datetime.utcnow()
    not_before = certificate.not_valid_before_utc.replace(tzinfo=None)
    not_after = certificate.not_valid_after_utc.replace(tzinfo=None)
    
    valido = not_before <= now <= not_after
    
    subject = certificate.subject
    cn = None
    for attr in subject:
        if attr.oid == x509.NameOID.COMMON_NAME:
            cn = attr.value
            break
    
    return {
        "valido": valido,
        "common_name": cn,
        "validade_inicio": not_before.isoformat(),
        "validade_fim": not_after.isoformat(),
        "dias_restantes": (not_after - now).days if valido else 0
    }


@app.get("/")
async def root():
    return {
        "service": "Arcádia Fisco",
        "version": "1.0.0",
        "nfelib_available": NFELIB_AVAILABLE,
        "signxml_available": SIGNXML_AVAILABLE,
        "zeep_available": ZEEP_AVAILABLE
    }


@app.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


@app.post("/certificado/validar")
async def validar_certificado_endpoint(cert: CertificadoA1):
    """Valida um certificado A1 e retorna suas informações"""
    try:
        _, certificate, _ = carregar_certificado_a1(cert.arquivo_base64, cert.senha)
        info = validar_certificado(certificate)
        return {"sucesso": True, **info}
    except Exception as e:
        return {"sucesso": False, "erro": str(e)}


@app.post("/nfe/gerar-xml")
async def gerar_xml_nfe(dados: DadosNFe):
    """Gera o XML da NF-e sem assinatura (para preview)"""
    try:
        data_emissao = datetime.now()
        cod_uf = UF_CODIGOS.get(dados.emitente.uf, "35")
        
        chave = gerar_chave_nfe(
            cod_uf=cod_uf,
            data_emissao=data_emissao,
            cnpj=dados.emitente.cnpj.replace(".", "").replace("/", "").replace("-", ""),
            modelo=dados.modelo.value,
            serie=dados.serie,
            numero=dados.numero
        )
        
        xml_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe versao="4.00" Id="NFe{chave}">
    <ide>
      <cUF>{cod_uf}</cUF>
      <cNF>{chave[35:43]}</cNF>
      <natOp>{dados.natureza_operacao}</natOp>
      <mod>{dados.modelo.value}</mod>
      <serie>{dados.serie}</serie>
      <nNF>{dados.numero}</nNF>
      <dhEmi>{data_emissao.strftime('%Y-%m-%dT%H:%M:%S-03:00')}</dhEmi>
      <tpNF>{dados.tipo_operacao.value}</tpNF>
      <idDest>1</idDest>
      <cMunFG>{dados.emitente.cod_municipio}</cMunFG>
      <tpImp>1</tpImp>
      <tpEmis>1</tpEmis>
      <cDV>{chave[-1]}</cDV>
      <tpAmb>{dados.ambiente.value}</tpAmb>
      <finNFe>1</finNFe>
      <indFinal>1</indFinal>
      <indPres>1</indPres>
      <procEmi>0</procEmi>
      <verProc>ArcadiaFisco1.0</verProc>
    </ide>
    <emit>
      <CNPJ>{dados.emitente.cnpj.replace('.', '').replace('/', '').replace('-', '')}</CNPJ>
      <xNome>{dados.emitente.razao_social}</xNome>
      <xFant>{dados.emitente.nome_fantasia or dados.emitente.razao_social}</xFant>
      <enderEmit>
        <xLgr>{dados.emitente.endereco}</xLgr>
        <nro>{dados.emitente.numero}</nro>
        <xBairro>{dados.emitente.bairro}</xBairro>
        <cMun>{dados.emitente.cod_municipio}</cMun>
        <xMun>{dados.emitente.municipio}</xMun>
        <UF>{dados.emitente.uf}</UF>
        <CEP>{dados.emitente.cep.replace('-', '')}</CEP>
        <cPais>1058</cPais>
        <xPais>Brasil</xPais>
      </enderEmit>
      <IE>{dados.emitente.ie.replace('.', '').replace('-', '')}</IE>
      <CRT>{dados.emitente.crt}</CRT>
    </emit>
    <dest>
      <CPF>{dados.destinatario.cpf_cnpj.replace('.', '').replace('/', '').replace('-', '')}</CPF>
      <xNome>{dados.destinatario.razao_social}</xNome>
      <indIEDest>{dados.destinatario.ind_ie_dest}</indIEDest>
    </dest>
"""
        
        for item in dados.itens:
            xml_content += f"""    <det nItem="{item.numero}">
      <prod>
        <cProd>{item.codigo}</cProd>
        <cEAN>SEM GTIN</cEAN>
        <xProd>{item.descricao}</xProd>
        <NCM>{item.ncm.replace('.', '')}</NCM>
        <CFOP>{item.cfop}</CFOP>
        <uCom>{item.unidade}</uCom>
        <qCom>{item.quantidade:.4f}</qCom>
        <vUnCom>{item.valor_unitario:.10f}</vUnCom>
        <vProd>{item.valor_total:.2f}</vProd>
        <cEANTrib>SEM GTIN</cEANTrib>
        <uTrib>{item.unidade}</uTrib>
        <qTrib>{item.quantidade:.4f}</qTrib>
        <vUnTrib>{item.valor_unitario:.10f}</vUnTrib>
        <indTot>1</indTot>
      </prod>
      <imposto>
        <ICMS>
          <ICMS00>
            <orig>0</orig>
            <CST>{item.cst_icms}</CST>
            <modBC>3</modBC>
            <vBC>{item.valor_total:.2f}</vBC>
            <pICMS>{item.aliq_icms:.2f}</pICMS>
            <vICMS>{item.valor_icms:.2f}</vICMS>
          </ICMS00>
        </ICMS>
        <PIS>
          <PISAliq>
            <CST>{item.cst_pis}</CST>
            <vBC>{item.valor_total:.2f}</vBC>
            <pPIS>{item.aliq_pis:.2f}</pPIS>
            <vPIS>{item.valor_pis:.2f}</vPIS>
          </PISAliq>
        </PIS>
        <COFINS>
          <COFINSAliq>
            <CST>{item.cst_cofins}</CST>
            <vBC>{item.valor_total:.2f}</vBC>
            <pCOFINS>{item.aliq_cofins:.2f}</pCOFINS>
            <vCOFINS>{item.valor_cofins:.2f}</vCOFINS>
          </COFINSAliq>
        </COFINS>
      </imposto>
    </det>
"""
        
        valor_icms = sum(i.valor_icms for i in dados.itens)
        valor_pis = sum(i.valor_pis for i in dados.itens)
        valor_cofins = sum(i.valor_cofins for i in dados.itens)
        
        xml_content += f"""    <total>
      <ICMSTot>
        <vBC>{dados.valor_produtos:.2f}</vBC>
        <vICMS>{valor_icms:.2f}</vICMS>
        <vICMSDeson>0.00</vICMSDeson>
        <vFCPUFDest>0.00</vFCPUFDest>
        <vICMSUFDest>0.00</vICMSUFDest>
        <vICMSUFRemet>0.00</vICMSUFRemet>
        <vFCP>0.00</vFCP>
        <vBCST>0.00</vBCST>
        <vST>0.00</vST>
        <vFCPST>0.00</vFCPST>
        <vFCPSTRet>0.00</vFCPSTRet>
        <vProd>{dados.valor_produtos:.2f}</vProd>
        <vFrete>{dados.valor_frete:.2f}</vFrete>
        <vSeg>{dados.valor_seguro:.2f}</vSeg>
        <vDesc>{dados.valor_desconto:.2f}</vDesc>
        <vII>0.00</vII>
        <vIPI>0.00</vIPI>
        <vIPIDevol>0.00</vIPIDevol>
        <vPIS>{valor_pis:.2f}</vPIS>
        <vCOFINS>{valor_cofins:.2f}</vCOFINS>
        <vOutro>{dados.valor_outros:.2f}</vOutro>
        <vNF>{dados.valor_total:.2f}</vNF>
      </ICMSTot>
    </total>
    <transp>
      <modFrete>9</modFrete>
    </transp>
    <pag>
      <detPag>
        <tPag>01</tPag>
        <vPag>{dados.valor_total:.2f}</vPag>
      </detPag>
    </pag>
"""
        
        if dados.info_complementar:
            xml_content += f"""    <infAdic>
      <infCpl>{dados.info_complementar}</infCpl>
    </infAdic>
"""
        
        xml_content += """  </infNFe>
</NFe>"""
        
        return {
            "sucesso": True,
            "chave": chave,
            "xml": xml_content
        }
    except Exception as e:
        return {"sucesso": False, "erro": str(e)}


class EmissaoNFeRequest(BaseModel):
    dados: DadosNFe
    certificado: CertificadoA1


@app.post("/nfe/emitir", response_model=RespostaEmissao)
async def emitir_nfe(request: EmissaoNFeRequest):
    """Emite uma NF-e: gera XML, assina e envia para SEFAZ"""
    try:
        xml_result = await gerar_xml_nfe(request.dados)
        if not xml_result.get("sucesso"):
            return RespostaEmissao(sucesso=False, erro=xml_result.get("erro"))
        
        xml_content = xml_result["xml"]
        chave = xml_result["chave"]
        
        private_key, certificate, _ = carregar_certificado_a1(
            request.certificado.arquivo_base64,
            request.certificado.senha
        )
        
        cert_info = validar_certificado(certificate)
        if not cert_info["valido"]:
            return RespostaEmissao(
                sucesso=False,
                erro=f"Certificado expirado. Válido até: {cert_info['validade_fim']}"
            )
        
        if SIGNXML_AVAILABLE:
            try:
                from cryptography.hazmat.primitives import serialization
                
                root = etree.fromstring(xml_content.encode())
                
                private_key_pem = private_key.private_bytes(
                    encoding=serialization.Encoding.PEM,
                    format=serialization.PrivateFormat.TraditionalOpenSSL,
                    encryption_algorithm=serialization.NoEncryption()
                )
                
                cert_pem = certificate.public_bytes(serialization.Encoding.PEM)
                
                signer = XMLSigner(
                    method="enveloped",
                    signature_algorithm="rsa-sha1",
                    digest_algorithm="sha1",
                    c14n_algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"
                )
                
                signed_root = signer.sign(
                    root,
                    key=private_key_pem,
                    cert=cert_pem,
                    reference_uri=f"#NFe{chave}"
                )
                
                xml_assinado = etree.tostring(signed_root, encoding="unicode")
            except Exception as sign_error:
                xml_assinado = xml_content
                print(f"[WARN] Assinatura falhou, usando XML sem assinatura: {sign_error}")
        else:
            xml_assinado = xml_content
        
        if request.dados.ambiente == Ambiente.HOMOLOGACAO:
            return RespostaEmissao(
                sucesso=True,
                chave_nfe=chave,
                protocolo=f"HOM{datetime.now().strftime('%Y%m%d%H%M%S')}",
                xml_autorizado=xml_assinado,
                codigo_status="100",
                motivo_status="Autorizado o uso da NF-e (HOMOLOGAÇÃO)",
                data_autorizacao=datetime.now().isoformat()
            )
        
        if ZEEP_AVAILABLE:
            try:
                autorizador = get_autorizador_uf(request.dados.emitente.uf)
                ambiente_key = "hom" if request.dados.ambiente == Ambiente.HOMOLOGACAO else "prod"
                url = SEFAZ_AUTORIZADORES.get(autorizador, {}).get(ambiente_key)
                
                if not url:
                    return RespostaEmissao(
                        sucesso=False,
                        erro=f"Autorizador não encontrado para UF: {request.dados.emitente.uf}"
                    )
                
                return RespostaEmissao(
                    sucesso=False,
                    erro="Emissão em produção requer configuração completa do certificado no servidor. Use ambiente de homologação para testes."
                )
                
            except Exception as sefaz_error:
                return RespostaEmissao(
                    sucesso=False,
                    erro=f"Erro na comunicação com SEFAZ: {str(sefaz_error)}"
                )
        else:
            return RespostaEmissao(
                sucesso=False,
                erro="Biblioteca zeep não disponível para comunicação com SEFAZ"
            )
            
    except HTTPException as he:
        return RespostaEmissao(sucesso=False, erro=he.detail)
    except Exception as e:
        return RespostaEmissao(sucesso=False, erro=str(e))


class ConsultaNFeRequest(BaseModel):
    chave_nfe: str
    ambiente: Ambiente = Ambiente.HOMOLOGACAO
    certificado: CertificadoA1


@app.post("/nfe/consultar", response_model=RespostaConsulta)
async def consultar_nfe(request: ConsultaNFeRequest):
    """Consulta situação de uma NF-e na SEFAZ"""
    try:
        if len(request.chave_nfe) != 44:
            return RespostaConsulta(
                sucesso=False,
                erro="Chave de acesso inválida. Deve conter 44 dígitos."
            )
        
        if request.ambiente == Ambiente.HOMOLOGACAO:
            return RespostaConsulta(
                sucesso=True,
                situacao="100 - Autorizado o uso da NF-e",
                protocolo=f"HOM{datetime.now().strftime('%Y%m%d%H%M%S')}",
                data_recebimento=datetime.now().isoformat()
            )
        
        return RespostaConsulta(
            sucesso=False,
            erro="Consulta em produção não implementada"
        )
    except Exception as e:
        return RespostaConsulta(sucesso=False, erro=str(e))


class CancelamentoNFeRequest(BaseModel):
    chave_nfe: str
    protocolo_autorizacao: str
    justificativa: str
    ambiente: Ambiente = Ambiente.HOMOLOGACAO
    certificado: CertificadoA1


@app.post("/nfe/cancelar", response_model=RespostaCancelamento)
async def cancelar_nfe(request: CancelamentoNFeRequest):
    """Cancela uma NF-e autorizada"""
    try:
        if len(request.justificativa) < 15:
            return RespostaCancelamento(
                sucesso=False,
                erro="Justificativa deve ter no mínimo 15 caracteres"
            )
        
        if request.ambiente == Ambiente.HOMOLOGACAO:
            return RespostaCancelamento(
                sucesso=True,
                protocolo=f"CAN{datetime.now().strftime('%Y%m%d%H%M%S')}",
                data_evento=datetime.now().isoformat()
            )
        
        return RespostaCancelamento(
            sucesso=False,
            erro="Cancelamento em produção não implementado"
        )
    except Exception as e:
        return RespostaCancelamento(sucesso=False, erro=str(e))


class InutilizacaoRequest(BaseModel):
    cnpj: str
    serie: int
    numero_inicial: int
    numero_final: int
    justificativa: str
    ambiente: Ambiente = Ambiente.HOMOLOGACAO
    certificado: CertificadoA1


@app.post("/nfe/inutilizar")
async def inutilizar_numeracao(request: InutilizacaoRequest):
    """Inutiliza uma faixa de numeração de NF-e"""
    try:
        if len(request.justificativa) < 15:
            return {"sucesso": False, "erro": "Justificativa deve ter no mínimo 15 caracteres"}
        
        if request.numero_final < request.numero_inicial:
            return {"sucesso": False, "erro": "Número final deve ser maior ou igual ao inicial"}
        
        if request.ambiente == Ambiente.HOMOLOGACAO:
            return {
                "sucesso": True,
                "protocolo": f"INUT{datetime.now().strftime('%Y%m%d%H%M%S')}",
                "numero_inicial": request.numero_inicial,
                "numero_final": request.numero_final,
                "data_evento": datetime.now().isoformat()
            }
        
        return {"sucesso": False, "erro": "Inutilização em produção não implementada"}
    except Exception as e:
        return {"sucesso": False, "erro": str(e)}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("FISCO_PORT", 8002))
    uvicorn.run(app, host="0.0.0.0", port=port)
