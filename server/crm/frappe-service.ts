import { crmStorage } from "./storage";
import type { CrmFrappeConnector, CrmLead, CrmOpportunity, CrmProduct, CrmPartner } from "@shared/schema";

interface FrappeResponse<T = any> {
  data?: T;
  message?: string;
  exc_type?: string;
}

interface FrappeDocListItem {
  name: string;
  [key: string]: any;
}

export class FrappeService {
  private connector: CrmFrappeConnector;
  private baseUrl: string;
  private authHeader: string;

  constructor(connector: CrmFrappeConnector) {
    this.connector = connector;
    this.baseUrl = connector.baseUrl.replace(/\/$/, "");
    this.authHeader = `token ${connector.apiKey}:${connector.apiSecret}`;
  }

  private async request<T>(
    method: string,
    endpoint: string,
    data?: any
  ): Promise<FrappeResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    };

    if (data && (method === "POST" || method === "PUT")) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Frappe API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  async testConnection(): Promise<{ success: boolean; user?: string; error?: string }> {
    try {
      const result = await this.request<{ message: string }>(
        "GET",
        "/api/method/frappe.auth.get_logged_user"
      );
      return { success: true, user: result.message };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async getDocList(doctype: string, filters?: any[], fields?: string[], limit?: number): Promise<FrappeDocListItem[]> {
    let endpoint = `/api/resource/${doctype}`;
    const params = new URLSearchParams();
    
    if (filters) {
      params.append("filters", JSON.stringify(filters));
    }
    if (fields) {
      params.append("fields", JSON.stringify(fields));
    }
    if (limit) {
      params.append("limit_page_length", limit.toString());
    }

    const queryString = params.toString();
    if (queryString) {
      endpoint += `?${queryString}`;
    }

    const result = await this.request<{ data: FrappeDocListItem[] }>("GET", endpoint);
    return (result as any).data || [];
  }

  async getDoc(doctype: string, name: string): Promise<FrappeDocListItem | null> {
    try {
      const result = await this.request<{ data: FrappeDocListItem }>(
        "GET",
        `/api/resource/${doctype}/${encodeURIComponent(name)}`
      );
      return (result as any).data || null;
    } catch {
      return null;
    }
  }

  async createDoc(doctype: string, data: Record<string, any>): Promise<FrappeDocListItem> {
    const result = await this.request<{ data: FrappeDocListItem }>(
      "POST",
      `/api/resource/${doctype}`,
      data
    );
    return (result as any).data!;
  }

  async updateDoc(doctype: string, name: string, data: Record<string, any>): Promise<FrappeDocListItem> {
    const result = await this.request<{ data: FrappeDocListItem }>(
      "PUT",
      `/api/resource/${doctype}/${encodeURIComponent(name)}`,
      data
    );
    return (result as any).data!;
  }

  async syncLeadsToFrappe(leads: CrmLead[]): Promise<{ success: number; failed: number; errors: string[] }> {
    const errors: string[] = [];
    let success = 0;
    let failed = 0;

    for (const lead of leads) {
      try {
        const frappeData = {
          lead_name: lead.name,
          email_id: lead.email,
          phone: lead.phone,
          company_name: lead.company,
          job_title: lead.position,
          source: this.mapLeadSource(lead.source),
          notes: lead.notes,
        };

        await this.createDoc("Lead", frappeData);
        success++;
      } catch (error: any) {
        failed++;
        errors.push(`Lead ${lead.name}: ${error.message}`);
      }
    }

    return { success, failed, errors };
  }

  async syncOpportunitiesToFrappe(opportunities: CrmOpportunity[]): Promise<{ success: number; failed: number; errors: string[] }> {
    const errors: string[] = [];
    let success = 0;
    let failed = 0;

    for (const opp of opportunities) {
      try {
        const frappeData = {
          opportunity_type: "Sales",
          status: this.mapOpportunityStatus(opp.status),
          opportunity_amount: (opp.value || 0) / 100,
          opportunity_owner: opp.name,
          notes: opp.description,
          expected_closing: opp.expectedCloseDate,
        };

        await this.createDoc("Opportunity", frappeData);
        success++;
      } catch (error: any) {
        failed++;
        errors.push(`Opportunity ${opp.name}: ${error.message}`);
      }
    }

    return { success, failed, errors };
  }

  async syncProductsToFrappe(products: CrmProduct[]): Promise<{ success: number; failed: number; errors: string[] }> {
    const errors: string[] = [];
    let success = 0;
    let failed = 0;

    for (const product of products) {
      try {
        const frappeData = {
          item_code: product.sku || `ITEM-${product.id}`,
          item_name: product.name,
          description: product.description,
          item_group: product.category || "Products",
          is_stock_item: product.type === "product" ? 1 : 0,
          is_sales_item: 1,
          standard_rate: (product.price || 0) / 100,
        };

        await this.createDoc("Item", frappeData);
        success++;
      } catch (error: any) {
        failed++;
        errors.push(`Product ${product.name}: ${error.message}`);
      }
    }

    return { success, failed, errors };
  }

  async syncPartnersToFrappe(partners: CrmPartner[]): Promise<{ success: number; failed: number; errors: string[] }> {
    const errors: string[] = [];
    let success = 0;
    let failed = 0;

    for (const partner of partners) {
      try {
        const frappeData = {
          supplier_name: partner.name,
          supplier_type: "Partner",
          country: "Brazil",
          supplier_primary_contact: partner.primaryContactName,
          supplier_primary_address: partner.city && partner.state ? `${partner.city}, ${partner.state}` : undefined,
        };

        await this.createDoc("Supplier", frappeData);
        success++;
      } catch (error: any) {
        failed++;
        errors.push(`Partner ${partner.name}: ${error.message}`);
      }
    }

    return { success, failed, errors };
  }

  async pullLeadsFromFrappe(): Promise<{ leads: any[]; count: number }> {
    const leads = await this.getDocList("Lead", undefined, [
      "name", "lead_name", "email_id", "phone", "company_name", 
      "job_title", "source", "status", "notes"
    ], 100);
    return { leads, count: leads.length };
  }

  async pullOpportunitiesFromFrappe(): Promise<{ opportunities: any[]; count: number }> {
    const opportunities = await this.getDocList("Opportunity", undefined, [
      "name", "opportunity_type", "status", "opportunity_amount",
      "opportunity_owner", "expected_closing", "notes"
    ], 100);
    return { opportunities, count: opportunities.length };
  }

  private mapLeadSource(source: string | null): string {
    const mapping: Record<string, string> = {
      website: "Website",
      referral: "Reference",
      linkedin: "Social Media",
      event: "Campaign",
      other: "Others",
    };
    return mapping[source || ""] || "Others";
  }

  private mapOpportunityStatus(status: string | null): string {
    const mapping: Record<string, string> = {
      open: "Open",
      won: "Converted",
      lost: "Lost",
    };
    return mapping[status || ""] || "Open";
  }
}

export async function createFrappeService(connectorId: number): Promise<FrappeService | null> {
  const connector = await crmStorage.getFrappeConnector(connectorId);
  if (!connector) return null;
  return new FrappeService(connector);
}
