import fetch from "node-fetch";

const ERPNEXT_URL = process.env.ERPNEXT_URL || "";
const ERPNEXT_API_KEY = process.env.ERPNEXT_API_KEY || "";
const ERPNEXT_API_SECRET = process.env.ERPNEXT_API_SECRET || "";

interface ERPNextResponse<T = unknown> {
  data: T;
  message?: string;
}

interface DocTypeField {
  name: string;
  label?: string;
  fieldtype: string;
  options?: string;
  reqd?: number;
}

interface DocTypeInfo {
  name: string;
  module?: string;
  is_submittable?: number;
  is_tree?: number;
  istable?: number;
}

function getAuthHeader(): Record<string, string> {
  return {
    "Authorization": `token ${ERPNEXT_API_KEY}:${ERPNEXT_API_SECRET}`,
    "Content-Type": "application/json",
  };
}

function encodeDocType(doctype: string): string {
  return encodeURIComponent(doctype);
}

export async function testConnection(): Promise<{ success: boolean; message: string; user?: string }> {
  try {
    const response = await fetch(`${ERPNEXT_URL}/api/method/frappe.auth.get_logged_user`, {
      method: "GET",
      headers: getAuthHeader(),
    });

    if (!response.ok) {
      return { success: false, message: `Erro de conexão: ${response.status} ${response.statusText}` };
    }

    const data = await response.json() as ERPNextResponse<string>;
    return { success: true, message: "Conexão estabelecida com sucesso", user: data.message };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return { success: false, message: `Erro ao conectar: ${message}` };
  }
}

export async function listDocTypes(limit: number = 100): Promise<DocTypeInfo[]> {
  const response = await fetch(
    `${ERPNEXT_URL}/api/resource/DocType?fields=["name","module","is_submittable","is_tree","istable"]&limit_page_length=${limit}`,
    {
      method: "GET",
      headers: getAuthHeader(),
    }
  );

  if (!response.ok) {
    throw new Error(`Erro ao listar DocTypes: ${response.status}`);
  }

  const data = await response.json() as ERPNextResponse<DocTypeInfo[]>;
  return data.data;
}

export async function getDocTypeFields(doctype: string): Promise<DocTypeField[]> {
  const response = await fetch(
    `${ERPNEXT_URL}/api/resource/DocType/${encodeDocType(doctype)}`,
    {
      method: "GET",
      headers: getAuthHeader(),
    }
  );

  if (!response.ok) {
    throw new Error(`Erro ao buscar campos do DocType ${doctype}: ${response.status}`);
  }

  const data = await response.json() as ERPNextResponse<{ fields: DocTypeField[] }>;
  return data.data.fields || [];
}

export async function getDocuments<T = unknown>(
  doctype: string,
  filters?: Record<string, unknown>,
  fields?: string[],
  limit: number = 20,
  orderBy?: string
): Promise<T[]> {
  let url = `${ERPNEXT_URL}/api/resource/${encodeDocType(doctype)}?limit_page_length=${limit}`;

  if (fields && fields.length > 0) {
    url += `&fields=${encodeURIComponent(JSON.stringify(fields))}`;
  }

  if (filters && Object.keys(filters).length > 0) {
    url += `&filters=${encodeURIComponent(JSON.stringify(filters))}`;
  }

  if (orderBy) {
    url += `&order_by=${encodeURIComponent(orderBy)}`;
  }

  const response = await fetch(url, {
    method: "GET",
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    throw new Error(`Erro ao buscar documentos de ${doctype}: ${response.status}`);
  }

  const data = await response.json() as ERPNextResponse<T[]>;
  return data.data;
}

export async function getDocument<T = unknown>(doctype: string, name: string): Promise<T> {
  const response = await fetch(
    `${ERPNEXT_URL}/api/resource/${encodeDocType(doctype)}/${encodeURIComponent(name)}`,
    {
      method: "GET",
      headers: getAuthHeader(),
    }
  );

  if (!response.ok) {
    throw new Error(`Erro ao buscar documento ${doctype}/${name}: ${response.status}`);
  }

  const data = await response.json() as ERPNextResponse<T>;
  return data.data;
}

export async function createDocument<T = unknown>(
  doctype: string,
  documentData: Record<string, unknown>
): Promise<T> {
  const response = await fetch(
    `${ERPNEXT_URL}/api/resource/${encodeDocType(doctype)}`,
    {
      method: "POST",
      headers: getAuthHeader(),
      body: JSON.stringify(documentData),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro ao criar documento ${doctype}: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as ERPNextResponse<T>;
  return data.data;
}

export async function updateDocument<T = unknown>(
  doctype: string,
  name: string,
  documentData: Record<string, unknown>
): Promise<T> {
  const response = await fetch(
    `${ERPNEXT_URL}/api/resource/${encodeDocType(doctype)}/${encodeURIComponent(name)}`,
    {
      method: "PUT",
      headers: getAuthHeader(),
      body: JSON.stringify(documentData),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro ao atualizar documento ${doctype}/${name}: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as ERPNextResponse<T>;
  return data.data;
}

export async function deleteDocument(doctype: string, name: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(
    `${ERPNEXT_URL}/api/resource/${encodeDocType(doctype)}/${encodeURIComponent(name)}`,
    {
      method: "DELETE",
      headers: getAuthHeader(),
    }
  );

  if (!response.ok) {
    throw new Error(`Erro ao deletar documento ${doctype}/${name}: ${response.status}`);
  }

  return { success: true, message: `Documento ${name} deletado com sucesso` };
}

export async function runReport(
  reportName: string,
  filters?: Record<string, unknown>
): Promise<{ columns: unknown[]; data: unknown[] }> {
  let url = `${ERPNEXT_URL}/api/method/frappe.desk.query_report.run?report_name=${encodeURIComponent(reportName)}`;

  if (filters && Object.keys(filters).length > 0) {
    url += `&filters=${encodeURIComponent(JSON.stringify(filters))}`;
  }

  const response = await fetch(url, {
    method: "GET",
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    throw new Error(`Erro ao executar relatório ${reportName}: ${response.status}`);
  }

  const data = await response.json() as ERPNextResponse<{ result: unknown[]; columns: unknown[] }>;
  return {
    columns: data.message ? (data as unknown as { message: { columns: unknown[] } }).message.columns : [],
    data: data.message ? (data as unknown as { message: { result: unknown[] } }).message.result : [],
  };
}

export async function searchDocuments(
  doctype: string,
  searchTerm: string,
  fields?: string[],
  limit: number = 20
): Promise<unknown[]> {
  const searchFilters: (string | unknown)[][] = [];
  
  const doctypeFields = await getDocTypeFields(doctype);
  const textFields = doctypeFields
    .filter(f => ["Data", "Text", "Small Text", "Long Text", "Text Editor"].includes(f.fieldtype))
    .slice(0, 3)
    .map(f => f.name);

  if (textFields.length > 0) {
    textFields.forEach(field => {
      searchFilters.push([doctype, field, "like", `%${searchTerm}%`]);
    });
  }

  const orFilters: (string | unknown)[][] = searchFilters.length > 0 
    ? searchFilters 
    : [[doctype, "name", "like", `%${searchTerm}%`]];

  let url = `${ERPNEXT_URL}/api/resource/${encodeDocType(doctype)}?limit_page_length=${limit}`;
  url += `&or_filters=${encodeURIComponent(JSON.stringify(orFilters))}`;

  if (fields && fields.length > 0) {
    url += `&fields=${encodeURIComponent(JSON.stringify(fields))}`;
  }

  const response = await fetch(url, {
    method: "GET",
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    throw new Error(`Erro na busca em ${doctype}: ${response.status}`);
  }

  const data = await response.json() as ERPNextResponse<unknown[]>;
  return data.data;
}

export async function callMethod<T = unknown>(
  method: string,
  args?: Record<string, unknown>
): Promise<T> {
  const response = await fetch(
    `${ERPNEXT_URL}/api/method/${method}`,
    {
      method: "POST",
      headers: getAuthHeader(),
      body: args ? JSON.stringify(args) : undefined,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro ao chamar método ${method}: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as ERPNextResponse<T>;
  return data.message as T || data.data;
}

export function isConfigured(): boolean {
  return Boolean(ERPNEXT_URL && ERPNEXT_API_KEY && ERPNEXT_API_SECRET);
}

export function getConfig(): { url: string; configured: boolean } {
  return {
    url: ERPNEXT_URL,
    configured: isConfigured(),
  };
}
