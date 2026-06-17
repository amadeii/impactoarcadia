import { db } from "../../db/index";
import { eq, and, isNull, desc } from "drizzle-orm";
import { 
  persons, personRoles, mobileDevices, serviceOrders, 
  deviceEvaluations, imeiHistory, type PersonRole
} from "@shared/schema";
import * as erpnextService from "../erpnext/service";

interface SyncResult {
  success: boolean;
  created: number;
  updated: number;
  errors: string[];
  details?: unknown[];
}

interface ERPNextCustomer {
  name: string;
  customer_name: string;
  customer_type?: string;
  customer_group?: string;
  territory?: string;
  tax_id?: string;
  mobile_no?: string;
  email_id?: string;
  custom_arcadia_person_id?: number;
}

interface ERPNextSupplier {
  name: string;
  supplier_name: string;
  supplier_group?: string;
  supplier_type?: string;
  tax_id?: string;
  mobile_no?: string;
  email_id?: string;
  custom_arcadia_person_id?: number;
}

interface ERPNextItem {
  name: string;
  item_name: string;
  item_code: string;
  item_group?: string;
  stock_uom?: string;
  is_stock_item?: number;
  has_serial_no?: number;
  serial_no_series?: string;
  description?: string;
  standard_rate?: number;
  custom_brand?: string;
  custom_model?: string;
  custom_storage?: string;
  custom_color?: string;
}

interface ERPNextSerialNo {
  name: string;
  serial_no: string;
  item_code: string;
  status?: string;
  warehouse?: string;
  purchase_rate?: number;
  custom_imei2?: string;
  custom_condition?: string;
  custom_arcadia_device_id?: number;
}

export class RetailSyncService {
  
  async isERPNextConnected(): Promise<boolean> {
    if (!erpnextService.isConfigured()) return false;
    const result = await erpnextService.testConnection();
    return result.success;
  }

  // ========================================
  // PERSON SYNC - Persons ↔ Customer/Supplier
  // ========================================

  async syncPersonToERPNext(personId: number): Promise<SyncResult> {
    const result: SyncResult = { success: true, created: 0, updated: 0, errors: [] };

    try {
      const [person] = await db.select().from(persons).where(eq(persons.id, personId));
      if (!person) {
        result.success = false;
        result.errors.push(`Person ${personId} not found`);
        return result;
      }

      const roles = await db.select().from(personRoles).where(eq(personRoles.personId, personId));
      const roleTypes = roles.map((r: PersonRole) => r.roleType);

      // Sync as Customer if has customer role
      if (roleTypes.includes("customer")) {
        const customerResult = await this.syncPersonAsCustomer(person);
        if (customerResult.created) result.created++;
        if (customerResult.updated) result.updated++;
        if (customerResult.error) result.errors.push(customerResult.error);
      }

      // Sync as Supplier if has supplier role
      if (roleTypes.includes("supplier")) {
        const supplierResult = await this.syncPersonAsSupplier(person);
        if (supplierResult.created) result.created++;
        if (supplierResult.updated) result.updated++;
        if (supplierResult.error) result.errors.push(supplierResult.error);
      }

      result.success = result.errors.length === 0;
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : "Unknown error");
    }

    return result;
  }

  private async syncPersonAsCustomer(person: typeof persons.$inferSelect): Promise<{ created?: boolean; updated?: boolean; error?: string }> {
    try {
      const customerData = {
        customer_name: person.fullName,
        customer_type: person.cpfCnpj && person.cpfCnpj.length > 14 ? "Company" : "Individual",
        customer_group: "All Customer Groups",
        territory: "Brazil",
        tax_id: person.cpfCnpj || undefined,
        mobile_no: person.phone || person.whatsapp || undefined,
        email_id: person.email || undefined,
        custom_arcadia_person_id: person.id,
      };

      // Check if customer exists
      if (person.erpnextCustomerId) {
        await erpnextService.updateDocument("Customer", person.erpnextCustomerId, customerData);
        return { updated: true };
      }

      // Try to find by tax_id or create new
      if (person.cpfCnpj) {
        const existing = await erpnextService.getDocuments<ERPNextCustomer>(
          "Customer",
          { tax_id: person.cpfCnpj },
          ["name"],
          1
        );
        if (existing.length > 0) {
          await db.update(persons).set({ erpnextCustomerId: existing[0].name }).where(eq(persons.id, person.id));
          await erpnextService.updateDocument("Customer", existing[0].name, customerData);
          return { updated: true };
        }
      }

      // Create new customer
      const newCustomer = await erpnextService.createDocument<ERPNextCustomer>("Customer", customerData);
      await db.update(persons).set({ erpnextCustomerId: newCustomer.name }).where(eq(persons.id, person.id));
      return { created: true };
    } catch (error) {
      return { error: `Customer sync error: ${error instanceof Error ? error.message : "Unknown"}` };
    }
  }

  private async syncPersonAsSupplier(person: typeof persons.$inferSelect): Promise<{ created?: boolean; updated?: boolean; error?: string }> {
    try {
      const supplierData = {
        supplier_name: person.fullName,
        supplier_group: "All Supplier Groups",
        supplier_type: person.cpfCnpj && person.cpfCnpj.length > 14 ? "Company" : "Individual",
        tax_id: person.cpfCnpj || undefined,
        mobile_no: person.phone || person.whatsapp || undefined,
        email_id: person.email || undefined,
        custom_arcadia_person_id: person.id,
      };

      if (person.erpnextSupplierId) {
        await erpnextService.updateDocument("Supplier", person.erpnextSupplierId, supplierData);
        return { updated: true };
      }

      if (person.cpfCnpj) {
        const existing = await erpnextService.getDocuments<ERPNextSupplier>(
          "Supplier",
          { tax_id: person.cpfCnpj },
          ["name"],
          1
        );
        if (existing.length > 0) {
          await db.update(persons).set({ erpnextSupplierId: existing[0].name }).where(eq(persons.id, person.id));
          await erpnextService.updateDocument("Supplier", existing[0].name, supplierData);
          return { updated: true };
        }
      }

      const newSupplier = await erpnextService.createDocument<ERPNextSupplier>("Supplier", supplierData);
      await db.update(persons).set({ erpnextSupplierId: newSupplier.name }).where(eq(persons.id, person.id));
      return { created: true };
    } catch (error) {
      return { error: `Supplier sync error: ${error instanceof Error ? error.message : "Unknown"}` };
    }
  }

  async syncAllPersonsToERPNext(): Promise<SyncResult> {
    const result: SyncResult = { success: true, created: 0, updated: 0, errors: [], details: [] };

    try {
      const allPersons = await db.select().from(persons);

      for (const person of allPersons) {
        const syncResult = await this.syncPersonToERPNext(person.id);
        result.created += syncResult.created;
        result.updated += syncResult.updated;
        result.errors.push(...syncResult.errors);
      }

      result.success = result.errors.length === 0;
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : "Unknown error");
    }

    return result;
  }

  // ========================================
  // DEVICE SYNC - MobileDevices ↔ Item + Serial No
  // ========================================

  async syncDeviceToERPNext(deviceId: number): Promise<SyncResult> {
    const result: SyncResult = { success: true, created: 0, updated: 0, errors: [] };

    try {
      const [device] = await db.select().from(mobileDevices).where(eq(mobileDevices.id, deviceId));
      if (!device) {
        result.success = false;
        result.errors.push(`Device ${deviceId} not found`);
        return result;
      }

      // 1. Ensure Item exists (product template)
      const itemCode = `${device.brand}-${device.model}`.replace(/\s+/g, "-").toUpperCase();
      const itemResult = await this.ensureItemExists(device, itemCode);
      if (itemResult.error) {
        result.errors.push(itemResult.error);
      } else {
        if (itemResult.created) result.created++;
        if (itemResult.updated) result.updated++;
      }

      // 2. Create/Update Serial No for IMEI
      const serialResult = await this.syncDeviceAsSerialNo(device, itemCode);
      if (serialResult.error) {
        result.errors.push(serialResult.error);
      } else {
        if (serialResult.created) result.created++;
        if (serialResult.updated) result.updated++;
      }

      result.success = result.errors.length === 0;
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : "Unknown error");
    }

    return result;
  }

  private async ensureItemExists(device: typeof mobileDevices.$inferSelect, itemCode: string): Promise<{ created?: boolean; updated?: boolean; error?: string }> {
    try {
      // Check if item exists
      try {
        await erpnextService.getDocument("Item", itemCode);
        return { updated: true }; // Item exists
      } catch {
        // Item doesn't exist, create it
      }

      const itemData = {
        item_code: itemCode,
        item_name: `${device.brand} ${device.model}`,
        item_group: "Mobile Devices",
        stock_uom: "Nos",
        is_stock_item: 1,
        has_serial_no: 1,
        serial_no_series: "IMEI-.#####",
        description: `${device.brand} ${device.model} - ${device.storage || ""}`,
        custom_brand: device.brand,
        custom_model: device.model,
        custom_storage: device.storage,
      };

      await erpnextService.createDocument("Item", itemData);
      return { created: true };
    } catch (error) {
      return { error: `Item sync error: ${error instanceof Error ? error.message : "Unknown"}` };
    }
  }

  private async syncDeviceAsSerialNo(device: typeof mobileDevices.$inferSelect, itemCode: string): Promise<{ created?: boolean; updated?: boolean; error?: string }> {
    try {
      const serialNoData = {
        serial_no: device.imei,
        item_code: itemCode,
        status: device.status === "available" ? "Active" : device.status === "sold" ? "Delivered" : "Inactive",
        purchase_rate: device.acquisitionCost ? parseFloat(device.acquisitionCost) : undefined,
        custom_imei2: device.imei2 || undefined,
        custom_condition: device.condition,
        custom_arcadia_device_id: device.id,
      };

      if (device.erpnextSerialNo) {
        await erpnextService.updateDocument("Serial No", device.erpnextSerialNo, serialNoData);
        return { updated: true };
      }

      // Check if serial no exists by IMEI
      try {
        await erpnextService.getDocument("Serial No", device.imei);
        await db.update(mobileDevices).set({ erpnextSerialNo: device.imei }).where(eq(mobileDevices.id, device.id));
        await erpnextService.updateDocument("Serial No", device.imei, serialNoData);
        return { updated: true };
      } catch {
        // Serial No doesn't exist
      }

      await erpnextService.createDocument("Serial No", serialNoData);
      await db.update(mobileDevices).set({ erpnextSerialNo: device.imei }).where(eq(mobileDevices.id, device.id));
      return { created: true };
    } catch (error) {
      return { error: `Serial No sync error: ${error instanceof Error ? error.message : "Unknown"}` };
    }
  }

  // ========================================
  // SERVICE ORDER SYNC - ServiceOrders ↔ Maintenance Visit
  // ========================================

  async syncServiceOrderToERPNext(orderId: number): Promise<SyncResult> {
    const result: SyncResult = { success: true, created: 0, updated: 0, errors: [] };

    try {
      const [order] = await db.select().from(serviceOrders).where(eq(serviceOrders.id, orderId));
      if (!order) {
        result.success = false;
        result.errors.push(`Service Order ${orderId} not found`);
        return result;
      }

      // Get customer if exists
      let customerName: string | undefined;
      if (order.personId) {
        const [person] = await db.select().from(persons).where(eq(persons.id, order.personId));
        if (person?.erpnextCustomerId) {
          customerName = person.erpnextCustomerId;
        }
      }

      const maintenanceData = {
        naming_series: "MAI-VST-.YYYY.-",
        customer: customerName,
        mntc_date: new Date().toISOString().split("T")[0],
        mntc_time: new Date().toTimeString().split(" ")[0],
        completion_status: this.mapServiceStatus(order.status || "pending"),
        purposes: [{
          work_done: order.diagnosisNotes || "Pending diagnosis",
          service_unit: "Mobile Repair",
          description: order.issueDescription,
        }],
        custom_arcadia_order_id: order.id,
        custom_order_number: order.orderNumber,
        custom_device_brand: order.brand,
        custom_device_model: order.model,
        custom_device_imei: order.imei,
      };

      if (order.erpnextDocName) {
        await erpnextService.updateDocument("Maintenance Visit", order.erpnextDocName, maintenanceData);
        result.updated++;
      } else {
        const newDoc = await erpnextService.createDocument<{ name: string }>("Maintenance Visit", maintenanceData);
        await db.update(serviceOrders).set({ erpnextDocName: newDoc.name }).where(eq(serviceOrders.id, order.id));
        result.created++;
      }

      result.success = true;
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : "Unknown error");
    }

    return result;
  }

  private mapServiceStatus(status: string): string {
    const statusMap: Record<string, string> = {
      "pending": "Pending",
      "waiting_parts": "Pending",
      "in_progress": "Partially Completed",
      "completed": "Fully Completed",
      "delivered": "Fully Completed",
      "cancelled": "Cancelled",
    };
    return statusMap[status] || "Pending";
  }

  // ========================================
  // STOCK SYNC - Stock movements ↔ Stock Entry
  // ========================================

  async createStockEntry(
    entryType: "Material Receipt" | "Material Issue" | "Material Transfer",
    items: Array<{ itemCode: string; serialNo: string; qty: number; rate?: number }>,
    fromWarehouse?: string,
    toWarehouse?: string
  ): Promise<SyncResult> {
    const result: SyncResult = { success: true, created: 0, updated: 0, errors: [] };

    try {
      const stockEntryData = {
        stock_entry_type: entryType,
        from_warehouse: fromWarehouse,
        to_warehouse: toWarehouse,
        items: items.map(item => ({
          item_code: item.itemCode,
          serial_no: item.serialNo,
          qty: item.qty,
          basic_rate: item.rate,
          s_warehouse: fromWarehouse,
          t_warehouse: toWarehouse,
        })),
      };

      await erpnextService.createDocument("Stock Entry", stockEntryData);
      result.created++;
      result.success = true;
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : "Unknown error");
    }

    return result;
  }

  // ========================================
  // SALES SYNC - Sales → Sales Invoice
  // ========================================

  async createSalesInvoice(
    customerName: string,
    items: Array<{ itemCode: string; serialNo?: string; qty: number; rate: number }>,
    paymentMode?: string
  ): Promise<SyncResult> {
    const result: SyncResult = { success: true, created: 0, updated: 0, errors: [] };

    try {
      const invoiceData = {
        naming_series: "SINV-.YYYY.-",
        customer: customerName,
        posting_date: new Date().toISOString().split("T")[0],
        due_date: new Date().toISOString().split("T")[0],
        items: items.map(item => ({
          item_code: item.itemCode,
          serial_no: item.serialNo,
          qty: item.qty,
          rate: item.rate,
        })),
        custom_payment_mode: paymentMode,
        update_stock: 1,
      };

      await erpnextService.createDocument("Sales Invoice", invoiceData);
      result.created++;
      result.success = true;
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : "Unknown error");
    }

    return result;
  }

  // ========================================
  // IMPORT FROM ERPNEXT - Pull data into Arcadia
  // ========================================

  async importCustomersFromERPNext(limit: number = 100): Promise<SyncResult> {
    const result: SyncResult = { success: true, created: 0, updated: 0, errors: [] };

    try {
      const customers = await erpnextService.getDocuments<ERPNextCustomer>(
        "Customer",
        {},
        ["name", "customer_name", "tax_id", "mobile_no", "email_id", "custom_arcadia_person_id"],
        limit
      );

      for (const customer of customers) {
        try {
          // Skip if already linked
          if (customer.custom_arcadia_person_id) {
            const [existing] = await db.select().from(persons).where(eq(persons.id, customer.custom_arcadia_person_id));
            if (existing) continue;
          }

          // Check by tax_id
          if (customer.tax_id) {
            const [existing] = await db.select().from(persons).where(eq(persons.cpfCnpj, customer.tax_id));
            if (existing) {
              await db.update(persons).set({ erpnextCustomerId: customer.name }).where(eq(persons.id, existing.id));
              result.updated++;
              continue;
            }
          }

          // Create new person
          const [newPerson] = await db.insert(persons).values({
            fullName: customer.customer_name,
            cpfCnpj: customer.tax_id || null,
            phone: customer.mobile_no || null,
            email: customer.email_id || null,
            erpnextCustomerId: customer.name,
          }).returning();

          // Add customer role
          await db.insert(personRoles).values({
            personId: newPerson.id,
            roleType: "customer",
          });

          result.created++;
        } catch (error) {
          result.errors.push(`Error importing ${customer.name}: ${error instanceof Error ? error.message : "Unknown"}`);
        }
      }

      result.success = result.errors.length === 0;
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : "Unknown error");
    }

    return result;
  }

  async importSuppliersFromERPNext(limit: number = 100): Promise<SyncResult> {
    const result: SyncResult = { success: true, created: 0, updated: 0, errors: [] };

    try {
      const suppliers = await erpnextService.getDocuments<ERPNextSupplier>(
        "Supplier",
        {},
        ["name", "supplier_name", "tax_id", "mobile_no", "email_id", "custom_arcadia_person_id"],
        limit
      );

      for (const supplier of suppliers) {
        try {
          if (supplier.custom_arcadia_person_id) {
            const [existing] = await db.select().from(persons).where(eq(persons.id, supplier.custom_arcadia_person_id));
            if (existing) continue;
          }

          if (supplier.tax_id) {
            const [existing] = await db.select().from(persons).where(eq(persons.cpfCnpj, supplier.tax_id));
            if (existing) {
              await db.update(persons).set({ erpnextSupplierId: supplier.name }).where(eq(persons.id, existing.id));
              result.updated++;
              continue;
            }
          }

          const [newPerson] = await db.insert(persons).values({
            fullName: supplier.supplier_name,
            cpfCnpj: supplier.tax_id || null,
            phone: supplier.mobile_no || null,
            email: supplier.email_id || null,
            erpnextSupplierId: supplier.name,
          }).returning();

          await db.insert(personRoles).values({
            personId: newPerson.id,
            roleType: "supplier",
          });

          result.created++;
        } catch (error) {
          result.errors.push(`Error importing ${supplier.name}: ${error instanceof Error ? error.message : "Unknown"}`);
        }
      }

      result.success = result.errors.length === 0;
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : "Unknown error");
    }

    return result;
  }

  // ========================================
  // FULL SYNC - Sync everything
  // ========================================

  async runFullSync(): Promise<{
    persons: SyncResult;
    devices: SyncResult;
    serviceOrders: SyncResult;
    importedCustomers: SyncResult;
    importedSuppliers: SyncResult;
  }> {
    const personSync = await this.syncAllPersonsToERPNext();

    // Sync all devices
    const deviceSync: SyncResult = { success: true, created: 0, updated: 0, errors: [] };
    const allDevices = await db.select().from(mobileDevices);
    for (const device of allDevices) {
      const result = await this.syncDeviceToERPNext(device.id);
      deviceSync.created += result.created;
      deviceSync.updated += result.updated;
      deviceSync.errors.push(...result.errors);
    }
    deviceSync.success = deviceSync.errors.length === 0;

    // Sync all service orders
    const orderSync: SyncResult = { success: true, created: 0, updated: 0, errors: [] };
    const allOrders = await db.select().from(serviceOrders);
    for (const order of allOrders) {
      const result = await this.syncServiceOrderToERPNext(order.id);
      orderSync.created += result.created;
      orderSync.updated += result.updated;
      orderSync.errors.push(...result.errors);
    }
    orderSync.success = orderSync.errors.length === 0;

    // Import from ERPNext
    const importedCustomers = await this.importCustomersFromERPNext();
    const importedSuppliers = await this.importSuppliersFromERPNext();

    return {
      persons: personSync,
      devices: deviceSync,
      serviceOrders: orderSync,
      importedCustomers,
      importedSuppliers,
    };
  }
}

export const retailSyncService = new RetailSyncService();
