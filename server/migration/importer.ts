import { db } from '../../db';
import { 
  customers, products, posSales, retailSellers, retailStores, 
  serviceOrders, migrationLogs, finAccountsPayable, finAccountsReceivable
} from '@shared/schema';

interface ImportResult {
  imported: number;
  failed: number;
  errors: string[];
}

type BsonDocument = Record<string, any>;

interface ImportOptions {
  tenantId?: number;
  storeId?: number;
}

function transformValue(value: any, fieldName: string): any {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.startsWith('timestamp:')) return null;
  if (value === '<binary>' || value === '<timestamp>' || value === '<decimal128>') return null;
  
  if (fieldName.includes('date') || fieldName.includes('Date') || fieldName.includes('_at')) {
    if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
      return new Date(value);
    }
    return null;
  }
  
  if (fieldName.includes('price') || fieldName.includes('Price') || 
      fieldName.includes('amount') || fieldName.includes('Amount') ||
      fieldName.includes('valor') || fieldName.includes('Valor') ||
      fieldName.includes('cost') || fieldName.includes('Cost')) {
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'string') return value;
    return '0';
  }
  
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object') return JSON.stringify(value);
  
  return String(value);
}

function mapDocument(doc: BsonDocument, fieldMappings: Record<string, string>): Record<string, any> {
  const mapped: Record<string, any> = {};
  
  for (const [sourceField, targetField] of Object.entries(fieldMappings)) {
    if (sourceField in doc) {
      mapped[targetField] = transformValue(doc[sourceField], targetField);
    }
  }
  
  return mapped;
}

function generateCode(prefix: string, id: string): string {
  const shortId = id?.slice(-6) || Math.random().toString(36).slice(-6);
  return `${prefix}${shortId}`.toUpperCase();
}

async function logImportError(jobId: number, sourceId: string, message: string, details?: any) {
  try {
    await db.insert(migrationLogs).values({
      jobId,
      level: 'error',
      message,
      sourceId,
      details
    });
  } catch (e) {
    console.error('Failed to log import error:', e);
  }
}

async function importCustomers(docs: BsonDocument[], fieldMappings: Record<string, string>, jobId: number, options: ImportOptions): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, failed: 0, errors: [] };
  
  for (const doc of docs) {
    try {
      const mapped = mapDocument(doc, fieldMappings);
      const code = mapped.code || generateCode('CLI', doc._id);
      const name = mapped.name || mapped.legal_name || 'Cliente Importado';
      
      await db.insert(customers).values({
        tenantId: options.tenantId,
        code,
        name,
        taxId: mapped.cpf_cnpj || mapped.tax_id,
        email: mapped.email,
        phone: mapped.phone || mapped.mobile,
        address: [mapped.street, mapped.number, mapped.complement, mapped.neighborhood].filter(Boolean).join(', '),
        city: mapped.city,
        state: mapped.state,
        notes: mapped.notes
      }).onConflictDoNothing();
      
      result.imported++;
    } catch (error: any) {
      result.failed++;
      result.errors.push(`Doc ${doc._id}: ${error.message}`);
      await logImportError(jobId, doc._id, error.message, { mapped: mapDocument(doc, fieldMappings) });
    }
  }
  
  return result;
}

async function importProducts(docs: BsonDocument[], fieldMappings: Record<string, string>, jobId: number, options: ImportOptions): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, failed: 0, errors: [] };
  
  for (const doc of docs) {
    try {
      const mapped = mapDocument(doc, fieldMappings);
      const code = mapped.code || mapped.sku || generateCode('PRD', doc._id);
      const name = mapped.name || 'Produto Importado';
      
      await db.insert(products).values({
        tenantId: options.tenantId,
        code,
        name,
        description: mapped.description,
        category: mapped.category,
        unit: mapped.unit || 'UN',
        salePrice: mapped.sell_price || '0',
        costPrice: mapped.cost_price || '0',
        ncm: mapped.ncm,
        status: 'active'
      }).onConflictDoNothing();
      
      result.imported++;
    } catch (error: any) {
      result.failed++;
      result.errors.push(`Doc ${doc._id}: ${error.message}`);
      await logImportError(jobId, doc._id, error.message, {});
    }
  }
  
  return result;
}

async function importSales(docs: BsonDocument[], fieldMappings: Record<string, string>, jobId: number, options: ImportOptions): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, failed: 0, errors: [] };
  
  for (const doc of docs) {
    try {
      const mapped = mapDocument(doc, fieldMappings);
      
      let status = 'completed';
      const originalStatus = (mapped.status || '').toLowerCase();
      if (originalStatus.includes('cancelad')) status = 'cancelled';
      else if (originalStatus.includes('pendent') || originalStatus.includes('aberto')) status = 'pending';
      
      const saleNumber = mapped.sale_number?.toString() || `LEG-${Date.now()}-${Math.random().toString(36).slice(-4)}`;
      
      await db.insert(posSales).values({
        tenantId: options.tenantId,
        storeId: options.storeId || 1,
        saleNumber,
        subtotal: mapped.total_amount || '0',
        totalAmount: mapped.total_amount || '0',
        discountAmount: mapped.discount_amount || '0',
        status,
        paymentMethod: mapped.payment_method || 'dinheiro',
        notes: mapped.notes
      }).onConflictDoNothing();
      
      result.imported++;
    } catch (error: any) {
      result.failed++;
      result.errors.push(`Doc ${doc._id}: ${error.message}`);
      await logImportError(jobId, doc._id, error.message, {});
    }
  }
  
  return result;
}

async function importSellers(docs: BsonDocument[], fieldMappings: Record<string, string>, jobId: number, options: ImportOptions): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, failed: 0, errors: [] };
  
  for (const doc of docs) {
    try {
      const mapped = mapDocument(doc, fieldMappings);
      const name = mapped.name || 'Vendedor Importado';
      
      await db.insert(retailSellers).values({
        tenantId: options.tenantId,
        name,
        code: mapped.code?.toString(),
        email: mapped.email,
        phone: mapped.phone,
        isActive: true
      }).onConflictDoNothing();
      
      result.imported++;
    } catch (error: any) {
      result.failed++;
      result.errors.push(`Doc ${doc._id}: ${error.message}`);
      await logImportError(jobId, doc._id, error.message, {});
    }
  }
  
  return result;
}

async function importStores(docs: BsonDocument[], fieldMappings: Record<string, string>, jobId: number, options: ImportOptions): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, failed: 0, errors: [] };
  
  for (const doc of docs) {
    try {
      const mapped = mapDocument(doc, fieldMappings);
      const name = mapped.name || 'Loja Importada';
      const code = mapped.code || generateCode('LJ', doc._id);
      
      await db.insert(retailStores).values({
        tenantId: options.tenantId,
        name,
        code,
        legalName: mapped.legal_name,
        cnpj: mapped.cnpj,
        address: [mapped.street, mapped.number, mapped.complement].filter(Boolean).join(', '),
        city: mapped.city,
        state: mapped.state,
        zipCode: mapped.zip_code,
        email: mapped.email,
        phone: mapped.phone,
        status: 'active'
      }).onConflictDoNothing();
      
      result.imported++;
    } catch (error: any) {
      result.failed++;
      result.errors.push(`Doc ${doc._id}: ${error.message}`);
      await logImportError(jobId, doc._id, error.message, {});
    }
  }
  
  return result;
}

async function importServiceOrders(docs: BsonDocument[], fieldMappings: Record<string, string>, jobId: number, options: ImportOptions): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, failed: 0, errors: [] };
  
  for (const doc of docs) {
    try {
      const mapped = mapDocument(doc, fieldMappings);
      const orderNumber = mapped.order_number || `OS-LEG-${Date.now()}-${Math.random().toString(36).slice(-4)}`;
      const customerName = mapped.customer_name || 'Cliente';
      
      await db.insert(serviceOrders).values({
        tenantId: options.tenantId,
        storeId: options.storeId || 1,
        orderNumber,
        customerName,
        imei: mapped.imei || 'N/A',
        brand: mapped.brand || 'N/A',
        model: mapped.model || 'N/A',
        issueDescription: mapped.description || 'Importado do sistema legado',
        serviceType: mapped.service_type || 'repair',
        status: mapped.status || 'open',
        laborCost: '0',
        partsCost: '0',
        totalCost: '0'
      }).onConflictDoNothing();
      
      result.imported++;
    } catch (error: any) {
      result.failed++;
      result.errors.push(`Doc ${doc._id}: ${error.message}`);
      await logImportError(jobId, doc._id, error.message, {});
    }
  }
  
  return result;
}

async function importFinancialEntries(docs: BsonDocument[], fieldMappings: Record<string, string>, jobId: number, options: ImportOptions): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, failed: 0, errors: [] };
  
  for (const doc of docs) {
    try {
      const entrada = doc.Entrada || 0;
      const saida = doc.Saida || 0;
      const pago = doc.Pago || false;
      
      const docNumber = doc.NumeroDocumento || `LEG-${doc._id?.slice(-8)}`;
      const description = doc.Descricao || 'Lançamento importado';
      const dueDateStr = doc.DataVencimento ? new Date(doc.DataVencimento).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      const issueDateStr = doc.DataFluxo ? new Date(doc.DataFluxo).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      const paymentDate = doc.DataPagamento ? new Date(doc.DataPagamento) : null;
      
      if (entrada > 0) {
        await db.insert(finAccountsReceivable).values({
          documentNumber: docNumber,
          customerName: doc.Cliente || 'Cliente',
          description,
          issueDate: issueDateStr,
          dueDate: dueDateStr,
          originalAmount: entrada.toString(),
          discountAmount: (doc.Desconto || 0).toString(),
          interestAmount: (doc.Juro || 0).toString(),
          fineAmount: (doc.Multa || 0).toString(),
          receivedAmount: pago ? (doc.ValorPago || entrada).toString() : '0',
          remainingAmount: pago ? '0' : entrada.toString(),
          status: pago ? 'received' : 'pending',
          receivedAt: paymentDate,
          notes: doc.Observacoes
        }).onConflictDoNothing();
        result.imported++;
      } else if (saida > 0) {
        await db.insert(finAccountsPayable).values({
          documentNumber: docNumber,
          supplierName: doc.Cliente || 'Fornecedor',
          description,
          issueDate: issueDateStr,
          dueDate: dueDateStr,
          originalAmount: saida.toString(),
          discountAmount: (doc.Desconto || 0).toString(),
          interestAmount: (doc.Juro || 0).toString(),
          fineAmount: (doc.Multa || 0).toString(),
          paidAmount: pago ? (doc.ValorPago || saida).toString() : '0',
          remainingAmount: pago ? '0' : saida.toString(),
          status: pago ? 'paid' : 'pending',
          paidAt: paymentDate,
          notes: doc.Observacoes
        }).onConflictDoNothing();
        result.imported++;
      } else {
        result.failed++;
        result.errors.push(`Doc ${doc._id}: Sem valor de entrada ou saída`);
      }
    } catch (error: any) {
      result.failed++;
      result.errors.push(`Doc ${doc._id}: ${error.message}`);
      await logImportError(jobId, doc._id, error.message, {});
    }
  }
  
  return result;
}

async function importGeneric(docs: BsonDocument[], targetEntity: string, fieldMappings: Record<string, string>, jobId: number, _options: ImportOptions): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, failed: 0, errors: [] };
  
  for (const doc of docs) {
    try {
      const mapped = mapDocument(doc, fieldMappings);
      
      await db.insert(migrationLogs).values({
        jobId,
        level: 'info',
        message: `Registro mapeado para ${targetEntity}`,
        sourceId: doc._id?.toString(),
        details: mapped
      });
      
      result.imported++;
    } catch (error: any) {
      result.failed++;
      result.errors.push(`Doc ${doc._id}: ${error.message}`);
    }
  }
  
  return result;
}

export async function importToDatabase(
  targetEntity: string, 
  docs: BsonDocument[], 
  fieldMappings: Record<string, string>,
  jobId: number,
  options: ImportOptions = {}
): Promise<ImportResult> {
  switch (targetEntity) {
    case 'customers':
      return importCustomers(docs, fieldMappings, jobId, options);
    case 'products':
      return importProducts(docs, fieldMappings, jobId, options);
    case 'pos_sales':
      return importSales(docs, fieldMappings, jobId, options);
    case 'retail_sellers':
      return importSellers(docs, fieldMappings, jobId, options);
    case 'retail_stores':
      return importStores(docs, fieldMappings, jobId, options);
    case 'service_orders':
      return importServiceOrders(docs, fieldMappings, jobId, options);
    case 'fin_transactions':
    case 'fin_accounts_payable':
    case 'fin_accounts_receivable':
      return importFinancialEntries(docs, fieldMappings, jobId, options);
    default:
      return importGeneric(docs, targetEntity, fieldMappings, jobId, options);
  }
}

export function getImportableEntities() {
  return [
    // Cadastros Básicos
    { id: 'customers', name: 'Clientes', description: 'Cadastro de clientes', module: 'Cadastros' },
    { id: 'suppliers', name: 'Fornecedores', description: 'Cadastro de fornecedores', module: 'Cadastros' },
    { id: 'products', name: 'Produtos', description: 'Cadastro de produtos', module: 'Cadastros' },
    { id: 'persons', name: 'Pessoas', description: 'Cadastro unificado de pessoas', module: 'Cadastros' },
    { id: 'users', name: 'Usuários', description: 'Usuários do sistema', module: 'Cadastros' },
    
    // Retail / PDV
    { id: 'retail_stores', name: 'Lojas', description: 'Cadastro de lojas', module: 'Retail' },
    { id: 'retail_sellers', name: 'Vendedores', description: 'Cadastro de vendedores', module: 'Retail' },
    { id: 'retail_warehouses', name: 'Depósitos', description: 'Depósitos e estoque', module: 'Retail' },
    { id: 'retail_price_tables', name: 'Tabelas de Preço', description: 'Tabelas de preço', module: 'Retail' },
    { id: 'retail_promotions', name: 'Promoções', description: 'Promoções e descontos', module: 'Retail' },
    { id: 'pos_sales', name: 'Vendas PDV', description: 'Vendas do PDV', module: 'Retail' },
    { id: 'pos_sessions', name: 'Sessões PDV', description: 'Sessões de caixa', module: 'Retail' },
    
    // Assistência Técnica
    { id: 'service_orders', name: 'Ordens de Serviço', description: 'O.S. de assistência técnica', module: 'Assistência Técnica' },
    { id: 'mobile_devices', name: 'Dispositivos', description: 'Celulares e dispositivos', module: 'Assistência Técnica' },
    { id: 'device_evaluations', name: 'Avaliações', description: 'Avaliações de dispositivos', module: 'Assistência Técnica' },
    { id: 'device_history', name: 'Histórico Equipamentos', description: 'Histórico de dispositivos', module: 'Assistência Técnica' },
    
    // Financeiro
    { id: 'fin_transactions', name: 'Transações Financeiras', description: 'Contas (separação automática)', module: 'Financeiro' },
    { id: 'fin_accounts_payable', name: 'Contas a Pagar', description: 'Lançamentos a pagar', module: 'Financeiro' },
    { id: 'fin_accounts_receivable', name: 'Contas a Receber', description: 'Lançamentos a receber', module: 'Financeiro' },
    { id: 'fin_bank_accounts', name: 'Contas Bancárias', description: 'Contas bancárias', module: 'Financeiro' },
    { id: 'fin_payment_methods', name: 'Formas de Pagamento', description: 'Meios de pagamento', module: 'Financeiro' },
    { id: 'fin_cash_flow_categories', name: 'Plano de Contas', description: 'Categorias de fluxo de caixa', module: 'Financeiro' },
    
    // CRM
    { id: 'crm_leads', name: 'Leads', description: 'Leads e prospects', module: 'CRM' },
    { id: 'crm_opportunities', name: 'Oportunidades', description: 'Oportunidades de negócio', module: 'CRM' },
    { id: 'crm_clients', name: 'Clientes CRM', description: 'Clientes do CRM', module: 'CRM' },
    { id: 'crm_contracts', name: 'Contratos', description: 'Contratos comerciais', module: 'CRM' },
    { id: 'crm_campaigns', name: 'Campanhas', description: 'Campanhas de marketing', module: 'CRM' },
    
    // Compras e Estoque
    { id: 'purchase_orders', name: 'Pedidos de Compra', description: 'Pedidos de compra', module: 'Compras' },
    { id: 'sales_orders', name: 'Pedidos de Venda', description: 'Pedidos de venda', module: 'Vendas' },
    { id: 'stock_transfers', name: 'Transferências', description: 'Transferências de estoque', module: 'Estoque' },
    
    // Fiscal
    { id: 'fiscal_notas', name: 'Notas Fiscais', description: 'NF-e/NFC-e emitidas', module: 'Fiscal' },
    { id: 'fiscal_ncms', name: 'NCMs', description: 'Classificação fiscal NCM', module: 'Fiscal' },
    { id: 'fiscal_cfops', name: 'CFOPs', description: 'Códigos fiscais', module: 'Fiscal' },
    
    // RH / People
    { id: 'people_funcionarios', name: 'Funcionários', description: 'Cadastro de funcionários', module: 'RH' },
    { id: 'people_cargos', name: 'Cargos', description: 'Cargos e funções', module: 'RH' },
    { id: 'people_departamentos', name: 'Departamentos', description: 'Departamentos', module: 'RH' },
    
    // Projetos / Qualidade
    { id: 'pc_projects', name: 'Projetos', description: 'Projetos e atividades', module: 'Projetos' },
    { id: 'pc_clients', name: 'Clientes Projetos', description: 'Clientes de projetos', module: 'Projetos' },
    { id: 'quality_samples', name: 'Amostras', description: 'Amostras laboratoriais', module: 'Qualidade' },
    { id: 'quality_lab_reports', name: 'Laudos', description: 'Laudos laboratoriais', module: 'Qualidade' },
    
    // XOS / Comunicação
    { id: 'xos_contacts', name: 'Contatos XOS', description: 'Contatos omnichannel', module: 'XOS' },
    { id: 'xos_conversations', name: 'Conversas', description: 'Histórico de conversas', module: 'XOS' },
    { id: 'xos_tickets', name: 'Tickets', description: 'Tickets de atendimento', module: 'XOS' },
    { id: 'xos_deals', name: 'Negociações', description: 'Negócios em andamento', module: 'XOS' },
    
    // Suporte
    { id: 'support_tickets', name: 'Tickets Suporte', description: 'Tickets de suporte', module: 'Suporte' },
    { id: 'support_knowledge_base', name: 'Base de Conhecimento', description: 'Artigos de ajuda', module: 'Suporte' }
  ];
}
