/**
 * INT-01 — intHandlers.ts
 * Registro central de todos os consumers de eventos do SOE.
 *
 * MAPA DE EVENTOS:
 *
 *   sale_order.confirmed
 *     → [COM] handleSaleOrderConfirmed       — gera AR no Control por parcela
 *     → [EST] handleSaleOrderConfirmed_Est   — cria reservas de estoque
 *
 *   sale_order.invoice_requested
 *     → [FISC] handleInvoiceRequested        — inicia emissão NF-e via FiscalAdapterV2
 *
 *   sale_order.invoiced
 *     → [EST] handleSaleOrderInvoiced        — converte reservas em saída física
 *
 *   sale_order.cancelled
 *     → [EST] handleSaleOrderCancelled_Est   — libera reservas de estoque
 *     → [CTL] handleSaleOrderCancelledControl — cancela ARs pendentes no Control
 *
 *   purchase_invoice.approved
 *     → [EST]  handlePurchaseInvoiceApproved_Est  — registra entrada física
 *     → [COMP] handlePurchaseInvoiceApproved_Comp — gera AP no Control por duplicata
 *
 *   fiscal_doc.authorized
 *     → [COM] handleFiscalDocAuthorized      — fecha ciclo: marca sale_order faturado
 */

import { registerHandler } from "../soe/eventBus";

// COM-01
import {
  handleSaleOrderConfirmed,
} from "../com/comService";

// EST-01
import {
  handleSaleOrderConfirmed_Est,
  handleSaleOrderInvoiced,
  handleSaleOrderCancelled_Est,
  handlePurchaseInvoiceApproved_Est,
} from "../est/estService";

// COMP-01
import {
  handlePurchaseInvoiceApproved_Comp,
} from "../comp/compService";

// INT-01 próprios
import { handleInvoiceRequested, handleFiscalDocAuthorized } from "./fiscalIntegration";
import { handleSaleOrderCancelledControl } from "./controlIntegration";

export function registerAllSoeHandlers(): void {

  // ── sale_order.confirmed ──────────────────────────────────────────────────
  registerHandler('sale_order.confirmed', handleSaleOrderConfirmed);
  registerHandler('sale_order.confirmed', handleSaleOrderConfirmed_Est);

  // ── sale_order.invoice_requested ─────────────────────────────────────────
  registerHandler('sale_order.invoice_requested', handleInvoiceRequested);

  // ── sale_order.invoiced ───────────────────────────────────────────────────
  registerHandler('sale_order.invoiced', handleSaleOrderInvoiced);

  // ── sale_order.cancelled ──────────────────────────────────────────────────
  registerHandler('sale_order.cancelled', handleSaleOrderCancelled_Est);
  registerHandler('sale_order.cancelled', handleSaleOrderCancelledControl);

  // ── purchase_invoice.approved ─────────────────────────────────────────────
  registerHandler('purchase_invoice.approved', handlePurchaseInvoiceApproved_Est);
  registerHandler('purchase_invoice.approved', handlePurchaseInvoiceApproved_Comp);

  // ── fiscal_doc.authorized ─────────────────────────────────────────────────
  registerHandler('fiscal_doc.authorized', handleFiscalDocAuthorized);

  console.log("[INT-01] Todos os handlers SOE registrados.");
}
