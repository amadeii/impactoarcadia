import { db } from "../../db/index";
import { eq, and, isNull, desc, inArray } from "drizzle-orm";
import {
  persons, personRoles, posSales, posSaleItems,
  tenantEmpresas, type PersonRole
} from "@shared/schema";
import { plusClient, type PlusCliente, type PlusVenda, type PlusVendaItem } from "../plus/client";

export interface PlusSyncResult {
  success: boolean;
  created: number;
  updated: number;
  errors: string[];
  details?: any;
}

export class RetailPlusSyncService {

  async isPlusConnected(): Promise<boolean> {
    const result = await plusClient.healthCheck();
    return result.success;
  }

  async getPlusStatus(): Promise<{
    connected: boolean;
    empresas: number;
    version?: string;
  }> {
    const health = await plusClient.healthCheck();
    let empresasCount = 0;
    if (health.success) {
      const empresas = await plusClient.listarEmpresas();
      empresasCount = Array.isArray(empresas.data) ? empresas.data.length : 0;
    }
    return {
      connected: health.success,
      empresas: empresasCount,
      version: health.data?.version,
    };
  }

  // ========================================
  // CUSTOMER SYNC - Persons → Plus Clientes
  // ========================================

  async syncPersonToPlus(personId: number, empresaId?: number): Promise<PlusSyncResult> {
    const result: PlusSyncResult = { success: true, created: 0, updated: 0, errors: [] };

    try {
      const [person] = await db.select().from(persons).where(eq(persons.id, personId));
      if (!person) {
        return { ...result, success: false, errors: [`Pessoa ${personId} não encontrada`] };
      }

      const roles = await db.select().from(personRoles).where(eq(personRoles.personId, personId));
      const roleTypes = roles.map((r: PersonRole) => r.roleType);

      if (roleTypes.includes("customer") || roleTypes.length === 0) {
        const clienteData: PlusCliente = {
          razao_social: person.fullName,
          cpf_cnpj: person.cpfCnpj || undefined,
          telefone: person.phone || undefined,
          celular: person.whatsapp || person.phone || undefined,
          email: person.email || undefined,
          cep: person.zipCode || undefined,
          logradouro: person.address || undefined,
          numero: person.addressNumber || undefined,
          bairro: person.neighborhood || undefined,
          cidade: person.city || undefined,
          uf: person.state || undefined,
        };

        if (person.plusClienteId) {
          const res = await plusClient.atualizarCliente(person.plusClienteId, clienteData, empresaId);
          if (res.success) {
            result.updated++;
          } else {
            result.errors.push(`Erro ao atualizar cliente: ${res.error}`);
          }
        } else {
          const res = await plusClient.criarCliente(clienteData, empresaId);
          if (res.success && res.data?.id) {
            await db.update(persons)
              .set({ plusClienteId: res.data.id, lastSyncAt: new Date() })
              .where(eq(persons.id, personId));
            result.created++;
          } else {
            result.errors.push(`Erro ao criar cliente: ${res.error}`);
          }
        }
      }

      if (roleTypes.includes("supplier")) {
        const fornecedorData = {
          razao_social: person.fullName,
          cpf_cnpj: person.cpfCnpj || undefined,
          telefone: person.phone || undefined,
          celular: person.whatsapp || person.phone || undefined,
          email: person.email || undefined,
        };

        if (person.plusFornecedorId) {
          result.updated++;
        } else {
          const res = await plusClient.criarFornecedor(fornecedorData, empresaId);
          if (res.success && res.data?.id) {
            await db.update(persons)
              .set({ plusFornecedorId: res.data.id, lastSyncAt: new Date() })
              .where(eq(persons.id, personId));
            result.created++;
          } else {
            result.errors.push(`Erro ao criar fornecedor: ${res.error}`);
          }
        }
      }

      result.success = result.errors.length === 0;
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : "Erro desconhecido");
    }

    return result;
  }

  async syncAllPersonsToPlus(tenantId: number, empresaId?: number): Promise<PlusSyncResult> {
    const result: PlusSyncResult = { success: true, created: 0, updated: 0, errors: [] };

    try {
      const allPersons = await db.select().from(persons)
        .where(and(eq(persons.isActive, true), eq(persons.tenantId, tenantId)));

      for (const person of allPersons) {
        const syncResult = await this.syncPersonToPlus(person.id, empresaId);
        result.created += syncResult.created;
        result.updated += syncResult.updated;
        result.errors.push(...syncResult.errors);
      }

      result.success = result.errors.length === 0;
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : "Erro desconhecido");
    }

    return result;
  }

  // ========================================
  // SALE SYNC - POS Sales → Plus Vendas
  // ========================================

  async syncSaleToPlus(saleId: number): Promise<PlusSyncResult> {
    const result: PlusSyncResult = { success: true, created: 0, updated: 0, errors: [] };

    try {
      const [sale] = await db.select().from(posSales).where(eq(posSales.id, saleId));
      if (!sale) {
        return { ...result, success: false, errors: [`Venda ${saleId} não encontrada`] };
      }

      if (sale.plusVendaId) {
        result.details = { plusVendaId: sale.plusVendaId, message: "Venda já sincronizada" };
        return result;
      }

      if (sale.status !== "completed") {
        return { ...result, success: false, errors: ["Só vendas completas podem ser sincronizadas"] };
      }

      let empresaId: number | undefined;
      if (sale.empresaId) {
        const [empresa] = await db.select().from(tenantEmpresas).where(eq(tenantEmpresas.id, sale.empresaId));
        empresaId = empresa?.plusEmpresaId || undefined;
      }

      let plusClienteId: number | undefined;
      if (sale.customerId) {
        const personId = parseInt(sale.customerId);
        if (!isNaN(personId)) {
          const [person] = await db.select().from(persons).where(eq(persons.id, personId));
          if (person) {
            if (!person.plusClienteId) {
              await this.syncPersonToPlus(person.id, empresaId);
              const [updated] = await db.select().from(persons).where(eq(persons.id, personId));
              plusClienteId = updated?.plusClienteId || undefined;
            } else {
              plusClienteId = person.plusClienteId || undefined;
            }
          }
        }
      }

      const items = await db.select().from(posSaleItems).where(eq(posSaleItems.saleId, saleId));

      const vendaItems: PlusVendaItem[] = items.map(item => ({
        produto_id: 0,
        quantidade: item.quantity || 1,
        valor_unitario: parseFloat(item.unitPrice) || 0,
        desconto: parseFloat(item.discountAmount || "0") || 0,
        valor_total: parseFloat(item.totalPrice) || 0,
      }));

      const paymentMap: Record<string, string> = {
        cash: "dinheiro",
        debit: "debito",
        credit: "credito",
        pix: "pix",
        combined: "outros",
      };

      const vendaData: PlusVenda = {
        cliente_id: plusClienteId,
        valor_total: parseFloat(sale.totalAmount) || 0,
        desconto: parseFloat(sale.discountAmount || "0") || 0,
        forma_pagamento: paymentMap[sale.paymentMethod || ""] || "dinheiro",
        observacao: `Venda PDV #${sale.saleNumber}${sale.notes ? ` - ${sale.notes}` : ""}`,
        itens: vendaItems,
        faturar: [{
          forma_pagamento: paymentMap[sale.paymentMethod || ""] || "dinheiro",
          valor: parseFloat(sale.totalAmount) || 0,
          parcelas: sale.installments || 1,
        }],
      };

      const res = await plusClient.criarVenda(vendaData, empresaId);

      if (res.success) {
        const plusId = res.data?.id || res.data?.venda?.id;
        await db.update(posSales).set({
          plusVendaId: plusId,
          plusSyncStatus: "synced",
          plusSyncedAt: new Date(),
          plusSyncError: null,
        }).where(eq(posSales.id, saleId));
        result.created++;
        result.details = { plusVendaId: plusId };
      } else {
        await db.update(posSales).set({
          plusSyncStatus: "error",
          plusSyncError: res.error || "Erro desconhecido",
        }).where(eq(posSales.id, saleId));
        result.errors.push(`Erro ao criar venda no Plus: ${res.error}`);
      }

      result.success = result.errors.length === 0;
    } catch (error) {
      result.success = false;
      const errMsg = error instanceof Error ? error.message : "Erro desconhecido";
      result.errors.push(errMsg);
      await db.update(posSales).set({
        plusSyncStatus: "error",
        plusSyncError: errMsg,
      }).where(eq(posSales.id, saleId));
    }

    return result;
  }

  async syncPendingSalesToPlus(): Promise<PlusSyncResult> {
    const result: PlusSyncResult = { success: true, created: 0, updated: 0, errors: [] };

    try {
      const pendingSales = await db.select().from(posSales)
        .where(and(
          eq(posSales.status, "completed"),
          eq(posSales.plusSyncStatus, "pending")
        ))
        .orderBy(posSales.createdAt)
        .limit(50);

      for (const sale of pendingSales) {
        const syncResult = await this.syncSaleToPlus(sale.id);
        result.created += syncResult.created;
        result.updated += syncResult.updated;
        result.errors.push(...syncResult.errors);
      }

      result.success = result.errors.length === 0;
      result.details = { processed: pendingSales.length };
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : "Erro desconhecido");
    }

    return result;
  }

  // ========================================
  // FISCAL - Emitir NF-e/NFC-e via Plus
  // ========================================

  async emitirNFeSale(saleId: number, tipo: "nfe" | "nfce" = "nfce"): Promise<PlusSyncResult> {
    const result: PlusSyncResult = { success: true, created: 0, updated: 0, errors: [] };

    try {
      const [sale] = await db.select().from(posSales).where(eq(posSales.id, saleId));
      if (!sale) {
        return { ...result, success: false, errors: [`Venda ${saleId} não encontrada`] };
      }

      if (sale.plusNfeChave) {
        result.details = { chave: sale.plusNfeChave, message: "NF-e já emitida" };
        return result;
      }

      if (!sale.plusVendaId) {
        const syncResult = await this.syncSaleToPlus(saleId);
        if (!syncResult.success) {
          return { ...result, success: false, errors: ["Sincronize a venda antes de emitir NF-e"] };
        }
      }

      let empresaId: number | undefined;
      if (sale.empresaId) {
        const [empresa] = await db.select().from(tenantEmpresas).where(eq(tenantEmpresas.id, sale.empresaId));
        empresaId = empresa?.plusEmpresaId || undefined;
      }

      const items = await db.select().from(posSaleItems).where(eq(posSaleItems.saleId, saleId));

      const nfeData = {
        venda_id: sale.plusVendaId || undefined,
        itens: items.map(item => ({
          produto_id: 0,
          quantidade: item.quantity || 1,
          valor_unitario: parseFloat(item.unitPrice) || 0,
        })),
        pagamentos: [{
          forma: sale.paymentMethod || "dinheiro",
          valor: parseFloat(sale.totalAmount) || 0,
        }],
      };

      const res = tipo === "nfe"
        ? await plusClient.emitirNFe(nfeData, empresaId)
        : await plusClient.emitirNFCe(nfeData, empresaId);

      if (res.success) {
        const chave = res.data?.chave || res.data?.nfe?.chave || null;
        await db.update(posSales).set({
          plusNfeChave: chave,
        }).where(eq(posSales.id, saleId));
        result.created++;
        result.details = { chave, tipo };
      } else {
        result.errors.push(`Erro ao emitir ${tipo.toUpperCase()}: ${res.error}`);
      }

      result.success = result.errors.length === 0;
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : "Erro desconhecido");
    }

    return result;
  }

  // ========================================
  // ACCOUNTS RECEIVABLE - Contas a Receber
  // ========================================

  async syncContasReceber(empresaId?: number): Promise<PlusSyncResult> {
    const result: PlusSyncResult = { success: true, created: 0, updated: 0, errors: [] };

    try {
      const res = await plusClient.listarContasReceber(empresaId);
      if (res.success) {
        result.details = {
          totalContas: Array.isArray(res.data) ? res.data.length : 0,
          data: res.data,
        };
      } else {
        result.errors.push(`Erro ao buscar contas: ${res.error}`);
      }

      result.success = result.errors.length === 0;
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : "Erro desconhecido");
    }

    return result;
  }

  // ========================================
  // INVENTORY SYNC - Stock → Plus Estoque
  // ========================================

  async syncStockToPlus(empresaId?: number): Promise<PlusSyncResult> {
    const result: PlusSyncResult = { success: true, created: 0, updated: 0, errors: [] };

    try {
      const plusEstoque = await plusClient.consultarEstoque(empresaId);
      if (plusEstoque.success) {
        result.details = {
          plusProducts: Array.isArray(plusEstoque.data) ? plusEstoque.data.length : 0,
          source: "plus",
        };
      }

      result.success = true;
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : "Erro desconhecido");
    }

    return result;
  }

  // ========================================
  // IMPORT FROM PLUS - Pull data into Retail
  // ========================================

  async importClientesFromPlus(tenantId: number, empresaId?: number): Promise<PlusSyncResult> {
    const result: PlusSyncResult = { success: true, created: 0, updated: 0, errors: [] };

    try {
      const res = await plusClient.listarClientes(empresaId);
      if (!res.success || !Array.isArray(res.data)) {
        return { ...result, success: false, errors: [res.error || "Erro ao listar clientes"] };
      }

      for (const cliente of res.data) {
        try {
          if (cliente.cpf_cnpj) {
            const [existing] = await db.select().from(persons)
              .where(and(eq(persons.cpfCnpj, cliente.cpf_cnpj), eq(persons.tenantId, tenantId)));
            if (existing) {
              if (!existing.plusClienteId && cliente.id) {
                await db.update(persons)
                  .set({ plusClienteId: cliente.id, lastSyncAt: new Date() })
                  .where(eq(persons.id, existing.id));
                result.updated++;
              }
              continue;
            }
          }

          const [newPerson] = await db.insert(persons).values({
            tenantId,
            fullName: cliente.razao_social,
            cpfCnpj: cliente.cpf_cnpj || null,
            phone: cliente.telefone || null,
            email: cliente.email || null,
            zipCode: cliente.cep || undefined,
            address: cliente.logradouro || undefined,
            addressNumber: cliente.numero || undefined,
            neighborhood: cliente.bairro || undefined,
            city: cliente.cidade || undefined,
            state: cliente.uf || undefined,
            plusClienteId: cliente.id,
          }).returning();

          await db.insert(personRoles).values({
            personId: newPerson.id,
            roleType: "customer",
          });

          result.created++;
        } catch (error) {
          result.errors.push(`Erro importando ${cliente.razao_social}: ${error instanceof Error ? error.message : "Desconhecido"}`);
        }
      }

      result.success = result.errors.length === 0;
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : "Erro desconhecido");
    }

    return result;
  }

  async importProdutosFromPlus(tenantId: number, empresaId?: number): Promise<PlusSyncResult> {
    const result: PlusSyncResult = { success: true, created: 0, updated: 0, errors: [] };

    try {
      const res = await plusClient.listarProdutos(empresaId);
      if (!res.success) {
        return { ...result, success: false, errors: [res.error || "Erro ao listar produtos"] };
      }

      result.details = {
        totalProdutos: Array.isArray(res.data) ? res.data.length : 0,
        source: "plus",
      };
      result.success = true;
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : "Erro desconhecido");
    }

    return result;
  }

  // ========================================
  // FULL SYNC - Sync everything
  // ========================================

  async runFullSync(tenantId: number, empresaId?: number): Promise<{
    status: string;
    plus: { connected: boolean };
    persons: PlusSyncResult;
    sales: PlusSyncResult;
    stock: PlusSyncResult;
    contasReceber: PlusSyncResult;
    importedClientes: PlusSyncResult;
  }> {
    const plusStatus = await this.isPlusConnected();

    if (!plusStatus) {
      return {
        status: "error",
        plus: { connected: false },
        persons: { success: false, created: 0, updated: 0, errors: ["Plus não conectado"] },
        sales: { success: false, created: 0, updated: 0, errors: ["Plus não conectado"] },
        stock: { success: false, created: 0, updated: 0, errors: ["Plus não conectado"] },
        contasReceber: { success: false, created: 0, updated: 0, errors: ["Plus não conectado"] },
        importedClientes: { success: false, created: 0, updated: 0, errors: ["Plus não conectado"] },
      };
    }

    const personSync = await this.syncAllPersonsToPlus(tenantId, empresaId);
    const salesSync = await this.syncPendingSalesToPlus();
    const stockSync = await this.syncStockToPlus(empresaId);
    const arSync = await this.syncContasReceber(empresaId);
    const importClientes = await this.importClientesFromPlus(tenantId, empresaId);

    return {
      status: "completed",
      plus: { connected: true },
      persons: personSync,
      sales: salesSync,
      stock: stockSync,
      contasReceber: arSync,
      importedClientes: importClientes,
    };
  }
}

export const retailPlusSyncService = new RetailPlusSyncService();
