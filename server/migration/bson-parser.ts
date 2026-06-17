import * as fs from 'fs';
import * as path from 'path';

interface BsonDocument {
  [key: string]: any;
}

interface ParseResult {
  collection: string;
  count: number;
  fields: string[];
  sample: BsonDocument | null;
  documents: BsonDocument[];
}

interface AnalysisResult {
  sourceType: string;
  sourceSystem: string;
  totalCollections: number;
  totalRecords: number;
  collections: {
    name: string;
    count: number;
    fields: string[];
    sampleData: BsonDocument | null;
  }[];
}

function decodeBsonElement(data: Buffer, offset: number): { key: string | null; value: any; newOffset: number } {
  if (offset >= data.length) {
    return { key: null, value: null, newOffset: offset };
  }

  const elemType = data[offset];
  offset += 1;

  const keyEnd = data.indexOf(0x00, offset);
  if (keyEnd === -1) {
    return { key: null, value: null, newOffset: data.length };
  }
  const key = data.slice(offset, keyEnd).toString('utf-8');
  offset = keyEnd + 1;

  let value: any = null;

  switch (elemType) {
    case 0x01: // double
      value = data.readDoubleLE(offset);
      offset += 8;
      break;
    case 0x02: // string
      const strLen = data.readInt32LE(offset);
      offset += 4;
      value = data.slice(offset, offset + strLen - 1).toString('utf-8');
      offset += strLen;
      break;
    case 0x03: // document
      const docLen = data.readInt32LE(offset);
      const { doc } = decodeBsonDoc(data, offset);
      value = doc;
      offset += docLen;
      break;
    case 0x04: // array
      const arrLen = data.readInt32LE(offset);
      const { doc: arrDoc } = decodeBsonDoc(data, offset);
      value = arrDoc ? Object.values(arrDoc) : [];
      offset += arrLen;
      break;
    case 0x05: // binary
      const binLen = data.readInt32LE(offset);
      offset += 5 + binLen;
      value = '<binary>';
      break;
    case 0x07: // ObjectId
      value = data.slice(offset, offset + 12).toString('hex');
      offset += 12;
      break;
    case 0x08: // boolean
      value = data[offset] !== 0;
      offset += 1;
      break;
    case 0x09: // datetime
      const ts = Number(data.readBigInt64LE(offset));
      try {
        value = new Date(ts).toISOString();
      } catch {
        value = `timestamp:${ts}`;
      }
      offset += 8;
      break;
    case 0x0A: // null
      value = null;
      break;
    case 0x10: // int32
      value = data.readInt32LE(offset);
      offset += 4;
      break;
    case 0x11: // timestamp
      offset += 8;
      value = '<timestamp>';
      break;
    case 0x12: // int64
      value = Number(data.readBigInt64LE(offset));
      offset += 8;
      break;
    case 0x13: // decimal128
      offset += 16;
      value = '<decimal128>';
      break;
    default:
      value = `<type:${elemType.toString(16)}>`;
  }

  return { key, value, newOffset: offset };
}

function decodeBsonDoc(data: Buffer, start: number = 0): { doc: BsonDocument | null; newOffset: number } {
  if (start + 4 > data.length) {
    return { doc: null, newOffset: start };
  }

  const docLen = data.readInt32LE(start);
  if (docLen <= 4 || start + docLen > data.length) {
    return { doc: null, newOffset: start };
  }

  const doc: BsonDocument = {};
  let offset = start + 4;
  const end = start + docLen - 1;

  while (offset < end) {
    const { key, value, newOffset } = decodeBsonElement(data, offset);
    if (key === null) break;
    doc[key] = value;
    offset = newOffset;
  }

  return { doc, newOffset: start + docLen };
}

export function parseBsonFile(filepath: string): BsonDocument[] {
  const data = fs.readFileSync(filepath);
  if (data.length === 0) return [];

  const docs: BsonDocument[] = [];
  let offset = 0;

  while (offset < data.length - 4) {
    const { doc, newOffset } = decodeBsonDoc(data, offset);
    if (doc === null || newOffset <= offset) break;
    docs.push(doc);
    offset = newOffset;
  }

  return docs;
}

export function analyzeBackupDirectory(dirPath: string): AnalysisResult {
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.bson'));
  
  const collections: AnalysisResult['collections'] = [];
  let totalRecords = 0;

  for (const file of files) {
    const collectionName = file.replace('.bson', '');
    const filepath = path.join(dirPath, file);
    
    try {
      const docs = parseBsonFile(filepath);
      const count = docs.length;
      totalRecords += count;

      if (count > 0) {
        const allFields = new Set<string>();
        docs.slice(0, 50).forEach(doc => {
          Object.keys(doc).forEach(k => allFields.add(k));
        });

        collections.push({
          name: collectionName,
          count,
          fields: Array.from(allFields).sort(),
          sampleData: docs[0] || null
        });
      }
    } catch (error) {
      console.error(`Error parsing ${file}:`, error);
    }
  }

  collections.sort((a, b) => b.count - a.count);

  return {
    sourceType: 'mongodb',
    sourceSystem: 'Sistema Legado',
    totalCollections: collections.length,
    totalRecords,
    collections
  };
}

export function getCollectionDocuments(dirPath: string, collectionName: string, limit?: number): BsonDocument[] {
  const filepath = path.join(dirPath, `${collectionName}.bson`);
  
  if (!fs.existsSync(filepath)) {
    throw new Error(`Collection ${collectionName} not found`);
  }

  const docs = parseBsonFile(filepath);
  return limit ? docs.slice(0, limit) : docs;
}

export const defaultMappings: Record<string, { target: string; fields: Record<string, string> }> = {
  DtoPessoa: {
    target: 'customers',
    fields: {
      '_id': 'legacy_id',
      'NomeFantasia': 'name',
      'RazaoSocial': 'legal_name',
      'CNPJ_CPF': 'cpf_cnpj',
      'IE': 'state_registration',
      'IM': 'municipal_registration',
      'Email': 'email',
      'Telefone': 'phone',
      'Celular': 'mobile',
      'Logradouro': 'street',
      'Numero': 'number',
      'Complemento': 'complement',
      'Bairro': 'neighborhood',
      'Cidade': 'city',
      'UF': 'state',
      'CEP': 'zip_code',
      'PessoaFisica': 'is_individual',
      'Observacoes': 'notes'
    }
  },
  DtoProduto: {
    target: 'products',
    fields: {
      '_id': 'legacy_id',
      'Nome': 'name',
      'Codigo': 'sku',
      'CodigoNFe': 'code',
      'Descricao': 'description',
      'PrecoVenda': 'sell_price',
      'PrecoCusto': 'cost_price',
      'NCM_NFe': 'ncm',
      'CEST_NFe': 'cest',
      'Categoria': 'category',
      'Marca': 'brand',
      'Unidade': 'unit',
      'Ativo': 'is_active',
      'ControlaEstoque': 'track_inventory'
    }
  },
  DtoVenda: {
    target: 'pos_sales',
    fields: {
      '_id': 'legacy_id',
      'Codigo': 'sale_number',
      'Data': 'created_at',
      'ValorTotal': 'total_amount',
      'ValorDesconto': 'discount_amount',
      'Status': 'status',
      'FormaPagamento': 'payment_method',
      'Observacoes': 'notes'
    }
  },
  DtoLancamento: {
    target: 'fin_transactions',
    fields: {
      '_id': 'legacy_id',
      'Descricao': 'description',
      'Entrada': 'entrada',
      'Saida': 'saida',
      'DataVencimento': 'due_date',
      'DataPagamento': 'payment_date',
      'Pago': 'is_paid',
      'ValorPago': 'paid_amount',
      'Cliente': 'customer_name',
      'FormaPagamento': 'payment_method',
      'PlanoDeConta': 'category',
      'Observacoes': 'notes'
    }
  },
  DtoColaborador: {
    target: 'retail_sellers',
    fields: {
      '_id': 'legacy_id',
      'Nome': 'name',
      'Codigo': 'code',
      'CPF': 'cpf',
      'Email': 'email',
      'Telefone': 'phone',
      'Tipo': 'role'
    }
  },
  DtoEmpresa: {
    target: 'retail_stores',
    fields: {
      '_id': 'legacy_id',
      'NomeFantasia': 'name',
      'RazaoSocial': 'legal_name',
      'CNPJ': 'cnpj',
      'InscricaoEstadual': 'state_registration',
      'Logradouro': 'street',
      'Numero': 'number',
      'Complemento': 'complement',
      'Cidade': 'city',
      'UF': 'state',
      'CEP': 'zip_code',
      'Email': 'email',
      'Telefone': 'phone'
    }
  },
  DtoCase: {
    target: 'service_orders',
    fields: {
      '_id': 'legacy_id',
      'Nome': 'order_number',
      'DataCadastro': 'created_at',
      'Descricao': 'description',
      'Cliente': 'customer_name',
      'Tipo': 'service_type',
      'Status': 'status'
    }
  }
};
