import type { Express, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import AdmZip from "adm-zip";
import * as BSON from "bson";
import { db } from "../../db/index";
import { biDatasets, stagedTables } from "@shared/schema";
import { sql } from "drizzle-orm";
import * as XLSX from "xlsx";

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [".csv", ".txt", ".json", ".zip", ".sql", ".bson", ".xlsx", ".xls"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Tipo de arquivo não suportado. Use CSV, TXT, JSON, SQL, ZIP ou Excel (.xlsx/.xls)."));
    }
  },
});

function parseCSV(content: string): { headers: string[]; rows: any[] } {
  const lines = content.trim().split("\n");
  if (lines.length === 0) return { headers: [], rows: [] };
  
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^["']|["']$/g, ""));
  const rows = lines.slice(1).map((line) => {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    
    for (const char of line) {
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    const row: any = {};
    headers.forEach((h, i) => {
      row[h] = values[i] || "";
    });
    return row;
  });
  
  return { headers, rows };
}

function parseExcel(filePath: string): { headers: string[]; rows: any[]; sheets: { name: string; rowCount: number }[] } {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheets: { name: string; rowCount: number }[] = [];
    let allHeaders: string[] = [];
    let allRows: any[] = [];

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
      
      console.log(`[Excel] Processing sheet "${sheetName}" with ${jsonData.length} rows`);
      
      if (jsonData.length > 0) {
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(jsonData.length, 10); i++) {
          const row = jsonData[i] || [];
          const nonEmptyCells = row.filter((cell: any) => cell !== null && cell !== undefined && String(cell).trim() !== '');
          if (nonEmptyCells.length >= 2) {
            headerRowIndex = i;
            break;
          }
        }
        
        const rawHeaders = jsonData[headerRowIndex] || [];
        const headers: string[] = [];
        const headerIndexMap: number[] = [];
        
        for (let i = 0; i < rawHeaders.length; i++) {
          const h = String(rawHeaders[i] || '').trim();
          if (h !== '') {
            headers.push(h);
            headerIndexMap.push(i);
          }
        }
        
        console.log(`[Excel] Found ${headers.length} headers at row ${headerRowIndex + 1}:`, headers.slice(0, 5));
        
        const rows = jsonData.slice(headerRowIndex + 1)
          .filter((row: any[]) => {
            const hasData = row && row.some((cell: any) => cell !== null && cell !== undefined && String(cell).trim() !== '');
            return hasData;
          })
          .map((row: any[]) => {
            const obj: any = {};
            headers.forEach((h: string, idx: number) => {
              const colIndex = headerIndexMap[idx];
              obj[h] = row[colIndex] !== undefined && row[colIndex] !== null ? String(row[colIndex]) : '';
            });
            return obj;
          });
        
        sheets.push({ name: sheetName, rowCount: rows.length });
        console.log(`[Excel] Sheet "${sheetName}": ${headers.length} columns, ${rows.length} data rows`);
        
        if (allHeaders.length === 0 && headers.length > 0) {
          allHeaders = headers;
          allRows = rows;
        }
      }
    }

    return { headers: allHeaders, rows: allRows, sheets };
  } catch (e) {
    console.error('Error parsing Excel:', e);
    return { headers: [], rows: [], sheets: [] };
  }
}

function parseJSON(content: string): { headers: string[]; rows: any[]; rootKey?: string } {
  try {
    const json = JSON.parse(content);
    
    if (Array.isArray(json) && json.length > 0) {
      const flatRows = json.map((item) => flattenObject(item));
      return { headers: Object.keys(flatRows[0]), rows: flatRows };
    }
    
    if (typeof json === 'object' && json !== null) {
      for (const key of Object.keys(json)) {
        if (Array.isArray(json[key]) && json[key].length > 0) {
          const flatRows = json[key].map((item: any) => flattenObject(item));
          return { headers: Object.keys(flatRows[0]), rows: flatRows, rootKey: key };
        }
      }
      const flatObj = flattenObject(json);
      return { headers: Object.keys(flatObj), rows: [flatObj] };
    }
    
    return { headers: [], rows: [] };
  } catch {
    return { headers: [], rows: [] };
  }
}

function flattenObject(obj: any, prefix = ''): any {
  const result: any = {};
  
  for (const key of Object.keys(obj)) {
    const newKey = prefix ? `${prefix}_${key}` : key;
    const value = obj[key];
    
    if (value === null || value === undefined) {
      result[newKey] = '';
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, newKey));
    } else if (Array.isArray(value)) {
      result[newKey] = JSON.stringify(value);
    } else {
      result[newKey] = String(value);
    }
  }
  
  return result;
}

interface ZipFileInfo {
  name: string;
  type: 'sql' | 'mongodb' | 'bson' | 'json' | 'csv' | 'unknown';
  size: number;
  content?: string;
  bsonData?: any[];
  tables?: string[];
  collections?: { name: string; documents: any[] }[];
  documentCount?: number;
}

function parseBsonBuffer(buffer: Buffer): any[] {
  const documents: any[] = [];
  let offset = 0;
  
  try {
    while (offset < buffer.length) {
      if (offset + 4 > buffer.length) break;
      
      const docSize = buffer.readInt32LE(offset);
      if (docSize <= 0 || offset + docSize > buffer.length) break;
      
      const docBuffer = buffer.slice(offset, offset + docSize);
      const doc = BSON.deserialize(docBuffer);
      documents.push(doc);
      offset += docSize;
    }
  } catch (e) {
    try {
      const singleDoc = BSON.deserialize(buffer);
      if (Array.isArray(singleDoc)) {
        return singleDoc;
      }
      return [singleDoc];
    } catch {
      return documents;
    }
  }
  
  return documents;
}

function parseZipFile(zipPath: string): { files: ZipFileInfo[]; summary: string } {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  const files: ZipFileInfo[] = [];
  
  for (const entry of entries) {
    if (entry.isDirectory) continue;
    
    const ext = path.extname(entry.entryName).toLowerCase();
    const fileName = path.basename(entry.entryName);
    
    if (fileName.endsWith('.metadata.json')) {
      continue;
    }
    
    if (ext === '.bson') {
      try {
        const buffer = entry.getData();
        const documents = parseBsonBuffer(buffer);
        const collectionName = path.basename(entry.entryName, '.bson');
        
        files.push({
          name: entry.entryName,
          type: 'bson',
          size: entry.header.size,
          bsonData: documents,
          documentCount: documents.length,
          collections: [{ name: collectionName, documents }],
        });
      } catch (e) {
        console.error(`Error parsing BSON file ${entry.entryName}:`, e);
        files.push({ 
          name: entry.entryName, 
          type: 'bson', 
          size: entry.header.size,
          documentCount: 0,
          collections: [],
        });
      }
      continue;
    }
    
    const content = entry.getData().toString('utf-8');
    
    if (ext === '.sql') {
      const tables = extractSqlTables(content);
      files.push({
        name: entry.entryName,
        type: 'sql',
        size: entry.header.size,
        content,
        tables,
      });
    } else if (ext === '.json') {
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          files.push({
            name: entry.entryName,
            type: 'mongodb',
            size: entry.header.size,
            content,
            documentCount: parsed.length,
            collections: [{ name: path.basename(entry.entryName, '.json'), documents: parsed }],
          });
        } else if (typeof parsed === 'object') {
          const collections: { name: string; documents: any[] }[] = [];
          let totalDocs = 0;
          for (const key of Object.keys(parsed)) {
            if (Array.isArray(parsed[key])) {
              collections.push({ name: key, documents: parsed[key] });
              totalDocs += parsed[key].length;
            }
          }
          files.push({
            name: entry.entryName,
            type: 'mongodb',
            size: entry.header.size,
            content,
            documentCount: totalDocs,
            collections,
          });
        }
      } catch {
        files.push({ name: entry.entryName, type: 'unknown', size: entry.header.size });
      }
    } else if (ext === '.csv' || ext === '.txt') {
      files.push({
        name: entry.entryName,
        type: 'csv',
        size: entry.header.size,
        content,
      });
    } else {
      files.push({ name: entry.entryName, type: 'unknown', size: entry.header.size });
    }
  }
  
  const sqlCount = files.filter(f => f.type === 'sql').length;
  const mongoCount = files.filter(f => f.type === 'mongodb' || f.type === 'bson').length;
  const csvCount = files.filter(f => f.type === 'csv').length;
  
  return {
    files,
    summary: `${sqlCount} SQL, ${mongoCount} MongoDB/JSON/BSON, ${csvCount} CSV/TXT`,
  };
}

function extractSqlTables(content: string): string[] {
  const tables: string[] = [];
  const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?(\w+)[`"']?/gi;
  let match;
  while ((match = createTableRegex.exec(content)) !== null) {
    tables.push(match[1]);
  }
  return tables;
}

function parseMySQLCreateTable(content: string, tableName: string): { columns: { name: string; type: string }[] } | null {
  const escapedTable = tableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const createRegex = new RegExp(
    `CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?[\`"']?${escapedTable}[\`"']?\\s*\\(([\\s\\S]*?)\\)\\s*(?:ENGINE|DEFAULT|CHARSET|COLLATE|;|$)`,
    'i'
  );
  
  const match = content.match(createRegex);
  if (!match) return null;
  
  const columnsSection = match[1];
  const columns: { name: string; type: string }[] = [];
  
  const lines = columnsSection.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('PRIMARY') || trimmed.startsWith('KEY') || 
        trimmed.startsWith('INDEX') || trimmed.startsWith('UNIQUE') || 
        trimmed.startsWith('FOREIGN') || trimmed.startsWith('CONSTRAINT')) {
      continue;
    }
    
    const colMatch = trimmed.match(/^[`"']?(\w+)[`"']?\s+(\w+(?:\([^)]+\))?)/i);
    if (colMatch) {
      const mysqlType = colMatch[2].toUpperCase();
      let pgType = 'TEXT';
      
      if (mysqlType.includes('BIGINT')) {
        pgType = 'BIGINT';
      } else if (mysqlType.includes('INT') || mysqlType.includes('TINYINT') || mysqlType.includes('SMALLINT')) {
        pgType = 'INTEGER';
      } else if (mysqlType.includes('DECIMAL') || mysqlType.includes('NUMERIC')) {
        pgType = mysqlType.replace(/UNSIGNED/gi, '').trim();
      } else if (mysqlType.includes('FLOAT') || mysqlType.includes('DOUBLE')) {
        pgType = 'DOUBLE PRECISION';
      } else if (mysqlType.includes('DATETIME') || mysqlType.includes('TIMESTAMP')) {
        pgType = 'TIMESTAMP';
      } else if (mysqlType.includes('DATE')) {
        pgType = 'DATE';
      } else if (mysqlType.includes('TIME')) {
        pgType = 'TIME';
      } else if (mysqlType === 'TINYINT(1)') {
        pgType = 'BOOLEAN';
      } else if (mysqlType.includes('TEXT') || mysqlType.includes('LONGTEXT') || mysqlType.includes('MEDIUMTEXT')) {
        pgType = 'TEXT';
      } else if (mysqlType.includes('VARCHAR') || mysqlType.includes('CHAR')) {
        pgType = 'TEXT';
      } else if (mysqlType.includes('BLOB') || mysqlType.includes('BINARY')) {
        pgType = 'BYTEA';
      } else if (mysqlType.includes('JSON')) {
        pgType = 'JSONB';
      }
      
      columns.push({ name: colMatch[1], type: pgType });
    }
  }
  
  return columns.length > 0 ? { columns } : null;
}

function parseSqlInserts(content: string, tableName: string): { headers: string[]; rows: any[] } {
  let headers: string[] = [];
  const rows: any[] = [];
  
  const escapedTable = tableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const insertRegex = new RegExp(
    `INSERT\\s+INTO\\s+[\`"']?${escapedTable}[\`"']?\\s*\\(([^)]+)\\)\\s*VALUES\\s*\\(([\\s\\S]*?)\\)(?:\\s*ON\\s+DUPLICATE|;)`,
    'gi'
  );
  
  let match;
  while ((match = insertRegex.exec(content)) !== null) {
    if (headers.length === 0) {
      headers = match[1]
        .split(',')
        .map(h => h.trim().replace(/[`"'\s]/g, ''))
        .filter(h => h.length > 0);
    }
    
    const valuesStr = match[2];
    const values = parseValueGroup(valuesStr);
    
    if (values.length > 0 && headers.length > 0) {
      const row: any = {};
      headers.forEach((h, i) => {
        let val = values[i] || '';
        if (val === 'NULL' || val === 'null') val = '';
        row[h] = val;
      });
      rows.push(row);
    }
  }
  
  if (rows.length === 0) {
    const simpleRegex = new RegExp(
      `INSERT\\s+INTO\\s+[\`"']?${escapedTable}[\`"']?\\s*\\(([^)]+)\\)\\s*VALUES\\s*([^;]+);`,
      'gi'
    );
    
    while ((match = simpleRegex.exec(content)) !== null) {
      if (headers.length === 0) {
        headers = match[1]
          .split(',')
          .map(h => h.trim().replace(/[`"'\s]/g, ''))
          .filter(h => h.length > 0);
      }
      
      const valuesSection = match[2];
      const valueGroups = valuesSection.match(/\(([^)]+)\)/g);
      
      if (valueGroups) {
        for (const group of valueGroups) {
          const values = parseValueGroup(group.slice(1, -1));
          const row: any = {};
          headers.forEach((h, i) => {
            let val = values[i] || '';
            if (val === 'NULL' || val === 'null') val = '';
            row[h] = val;
          });
          rows.push(row);
        }
      }
    }
  }
  
  return { headers, rows };
}

function parseValueGroup(str: string): string[] {
  const values: string[] = [];
  let current = '';
  let inString = false;
  let stringChar = '';
  let i = 0;
  
  while (i < str.length) {
    const char = str[i];
    
    if (!inString && (char === "'" || char === '"')) {
      inString = true;
      stringChar = char;
      i++;
      continue;
    }
    
    if (inString && char === stringChar) {
      if (str[i + 1] === stringChar) {
        current += char;
        i += 2;
        continue;
      }
      inString = false;
      i++;
      continue;
    }
    
    if (!inString && char === ',') {
      values.push(current.trim());
      current = '';
      i++;
      continue;
    }
    
    current += char;
    i++;
  }
  
  values.push(current.trim());
  return values;
}

export function registerUploadRoutes(app: Express): void {
  app.post("/api/bi/upload", upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      if (!req.file) {
        return res.status(400).json({ error: "Nenhum arquivo enviado" });
      }

      const ext = path.extname(req.file.originalname).toLowerCase();
      
      if (ext === ".zip") {
        const zipResult = parseZipFile(req.file.path);
        return res.json({
          success: true,
          filename: req.file.originalname,
          filepath: req.file.path,
          filesize: req.file.size,
          fileType: "zip",
          isZip: true,
          files: zipResult.files.map(f => ({
            name: f.name,
            type: f.type,
            size: f.size,
            tables: f.tables,
            collections: f.collections?.map(c => ({ name: c.name, count: c.documents.length })),
          })),
          summary: zipResult.summary,
        });
      }

      const content = fs.readFileSync(req.file.path, "utf-8");
      
      let headers: string[] = [];
      let rows: any[] = [];

      if (ext === ".csv" || ext === ".txt") {
        const parsed = parseCSV(content);
        headers = parsed.headers;
        rows = parsed.rows;
      } else if (ext === ".json") {
        const parsed = parseJSON(content);
        headers = parsed.headers;
        rows = parsed.rows;
      } else if (ext === ".sql") {
        const tables = extractSqlTables(content);
        return res.json({
          success: true,
          filename: req.file.originalname,
          filepath: req.file.path,
          filesize: req.file.size,
          fileType: "sql",
          isSql: true,
          tables,
          tableCount: tables.length,
        });
      } else if (ext === ".xlsx" || ext === ".xls") {
        const parsed = parseExcel(req.file.path);
        return res.json({
          success: true,
          filename: req.file.originalname,
          filepath: req.file.path,
          filesize: req.file.size,
          fileType: ext,
          isExcel: true,
          headers: parsed.headers,
          rowCount: parsed.rows.length,
          preview: parsed.rows.slice(0, 10),
          sheets: parsed.sheets,
        });
      }

      res.json({
        success: true,
        filename: req.file.originalname,
        filepath: req.file.path,
        filesize: req.file.size,
        fileType: ext,
        headers,
        rowCount: rows.length,
        preview: rows.slice(0, 10),
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      res.status(500).json({ error: error.message || "Falha no upload" });
    }
  });

  app.post("/api/bi/upload/zip-import", upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { filepath, selectedFiles, targetPrefix } = req.body;
      
      if (!filepath || !fs.existsSync(filepath)) {
        return res.status(400).json({ error: "Arquivo ZIP não encontrado" });
      }

      const zipResult = parseZipFile(filepath);
      const results: any[] = [];
      const prefix = (targetPrefix || "import").replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();

      for (const file of zipResult.files) {
        if (selectedFiles && !selectedFiles.includes(file.name)) continue;

        if (file.type === "sql" && file.content && file.tables) {
          for (const tableName of file.tables) {
            const parsed = parseSqlInserts(file.content, tableName);
            if (parsed.rows.length > 0) {
              const safeTableName = `staged_${prefix}_${tableName}`.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
              
              const columns = parsed.headers.map(h => `"${h.replace(/[^a-zA-Z0-9_]/g, "_")}" TEXT`);
              await db.execute(sql.raw(`DROP TABLE IF EXISTS "${safeTableName}"`));
              await db.execute(sql.raw(`CREATE TABLE "${safeTableName}" (id SERIAL PRIMARY KEY, ${columns.join(", ")})`));

              let importedCount = 0;
              for (const row of parsed.rows) {
                const values = parsed.headers.map(h => `'${String(row[h] || "").replace(/'/g, "''")}'`);
                try {
                  await db.execute(sql.raw(`INSERT INTO "${safeTableName}" (${parsed.headers.map(h => `"${h.replace(/[^a-zA-Z0-9_]/g, "_")}"`).join(", ")}) VALUES (${values.join(", ")})`));
                  importedCount++;
                } catch {}
              }

              const [staged] = await db.insert(stagedTables).values({
                userId: req.user!.id,
                name: tableName,
                sourceType: "sql",
                sourceFile: file.name,
                tableName: safeTableName,
                columns: JSON.stringify(parsed.headers),
                rowCount: importedCount,
                status: "ready",
              }).returning();

              results.push({ table: tableName, staged: safeTableName, rows: importedCount, stagedId: staged.id });
            }
          }
        } else if (file.type === "mongodb" && file.collections) {
          for (const collection of file.collections) {
            if (collection.documents.length === 0) continue;
            
            const flatDocs = collection.documents.map((doc: any) => flattenObject(doc));
            if (flatDocs.length === 0) continue;
            
            const allKeys = new Set<string>();
            for (const doc of flatDocs) {
              for (const key of Object.keys(doc)) {
                allKeys.add(key);
              }
            }
            const headers = Array.from(allKeys);
            
            const safeTableName = `staged_${prefix}_${collection.name}`.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();

            const columns = headers.map(h => `"${h.replace(/[^a-zA-Z0-9_]/g, "_")}" TEXT`);
            await db.execute(sql.raw(`DROP TABLE IF EXISTS "${safeTableName}"`));
            await db.execute(sql.raw(`CREATE TABLE "${safeTableName}" (id SERIAL PRIMARY KEY, ${columns.join(", ")})`));

            let importedCount = 0;
            for (const doc of flatDocs) {
              const values = headers.map(h => `'${String(doc[h] ?? "").replace(/'/g, "''")}'`);
              try {
                await db.execute(sql.raw(`INSERT INTO "${safeTableName}" (${headers.map(h => `"${h.replace(/[^a-zA-Z0-9_]/g, "_")}"`).join(", ")}) VALUES (${values.join(", ")})`));
                importedCount++;
              } catch {}
            }

            const [staged] = await db.insert(stagedTables).values({
              userId: req.user!.id,
              name: collection.name,
              sourceType: "mongodb",
              sourceFile: file.name,
              tableName: safeTableName,
              columns: JSON.stringify(headers),
              rowCount: importedCount,
              status: "ready",
            }).returning();

            results.push({ collection: collection.name, staged: safeTableName, rows: importedCount, stagedId: staged.id });
          }
        } else if (file.type === "bson" && file.collections) {
          for (const collection of file.collections) {
            if (!collection.documents || collection.documents.length === 0) continue;
            
            const flatDocs = collection.documents.map((doc: any) => flattenObject(doc));
            if (flatDocs.length === 0) continue;
            
            const allKeys = new Set<string>();
            for (const doc of flatDocs) {
              for (const key of Object.keys(doc)) {
                allKeys.add(key);
              }
            }
            const headers = Array.from(allKeys);
            
            const safeTableName = `staged_${prefix}_${collection.name}`.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();

            const columns = headers.map(h => `"${h.replace(/[^a-zA-Z0-9_]/g, "_")}" TEXT`);
            await db.execute(sql.raw(`DROP TABLE IF EXISTS "${safeTableName}"`));
            await db.execute(sql.raw(`CREATE TABLE "${safeTableName}" (id SERIAL PRIMARY KEY, ${columns.join(", ")})`));

            let importedCount = 0;
            for (const doc of flatDocs) {
              const values = headers.map(h => `'${String(doc[h] ?? "").replace(/'/g, "''")}'`);
              try {
                await db.execute(sql.raw(`INSERT INTO "${safeTableName}" (${headers.map(h => `"${h.replace(/[^a-zA-Z0-9_]/g, "_")}"`).join(", ")}) VALUES (${values.join(", ")})`));
                importedCount++;
              } catch {}
            }

            const [staged] = await db.insert(stagedTables).values({
              userId: req.user!.id,
              name: collection.name,
              sourceType: "mongodb",
              sourceFile: file.name,
              tableName: safeTableName,
              columns: JSON.stringify(headers),
              rowCount: importedCount,
              status: "ready",
            }).returning();

            results.push({ collection: collection.name, staged: safeTableName, rows: importedCount, stagedId: staged.id });
          }
        } else if (file.type === "csv" && file.content) {
          const parsed = parseCSV(file.content);
          if (parsed.rows.length > 0) {
            const baseName = path.basename(file.name, path.extname(file.name));
            const safeTableName = `staged_${prefix}_${baseName}`.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();

            const columns = parsed.headers.map(h => `"${h.replace(/[^a-zA-Z0-9_]/g, "_")}" TEXT`);
            await db.execute(sql.raw(`DROP TABLE IF EXISTS "${safeTableName}"`));
            await db.execute(sql.raw(`CREATE TABLE "${safeTableName}" (id SERIAL PRIMARY KEY, ${columns.join(", ")})`));

            let importedCount = 0;
            for (const row of parsed.rows) {
              const values = parsed.headers.map(h => `'${String(row[h] || "").replace(/'/g, "''")}'`);
              try {
                await db.execute(sql.raw(`INSERT INTO "${safeTableName}" (${parsed.headers.map(h => `"${h.replace(/[^a-zA-Z0-9_]/g, "_")}"`).join(", ")}) VALUES (${values.join(", ")})`));
                importedCount++;
              } catch {}
            }

            const [staged] = await db.insert(stagedTables).values({
              userId: req.user!.id,
              name: baseName,
              sourceType: "csv",
              sourceFile: file.name,
              tableName: safeTableName,
              columns: JSON.stringify(parsed.headers),
              rowCount: importedCount,
              status: "ready",
            }).returning();

            results.push({ file: baseName, staged: safeTableName, rows: importedCount, stagedId: staged.id });
          }
        }
      }

      try {
        fs.unlinkSync(filepath);
      } catch {}

      res.json({
        success: true,
        imported: results,
        totalTables: results.length,
        totalRows: results.reduce((sum, r) => sum + r.rows, 0),
      });
    } catch (error: any) {
      console.error("ZIP import error:", error);
      res.status(500).json({ error: error.message || "Falha na importação do ZIP" });
    }
  });

  app.post("/api/bi/upload/sql-import", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { filepath, selectedTables, targetPrefix } = req.body;
      
      if (!filepath || !selectedTables || !Array.isArray(selectedTables) || selectedTables.length === 0) {
        return res.status(400).json({ error: "Dados inválidos" });
      }

      if (!fs.existsSync(filepath)) {
        return res.status(400).json({ error: "Arquivo não encontrado" });
      }

      const content = fs.readFileSync(filepath, "utf-8");
      const safePrefix = (targetPrefix || "sql").replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
      
      const results: { table: string; pgTable: string; rows: number; datasetId?: number; structureOnly?: boolean }[] = [];

      for (const tableName of selectedTables) {
        const parsed = parseSqlInserts(content, tableName);
        const safeTableName = `uploaded_${safePrefix}_${tableName.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase()}`;
        
        if (parsed.headers.length > 0 && parsed.rows.length > 0) {
          const columns = parsed.headers.map((h: string) => {
            const safeName = h.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
            return `"${safeName}" TEXT`;
          });

          await db.execute(sql.raw(`DROP TABLE IF EXISTS "${safeTableName}"`));
          await db.execute(sql.raw(`CREATE TABLE "${safeTableName}" (id SERIAL PRIMARY KEY, ${columns.join(", ")})`));

          const columnNames = parsed.headers.map((h: string) => 
            `"${h.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase()}"`
          ).join(", ");

          let importedCount = 0;
          
          for (const row of parsed.rows) {
            const values = parsed.headers.map((h: string) => {
              const val = row[h] || "";
              const cleanVal = String(val).replace(/'/g, "''").replace(/\\/g, "\\\\");
              return `'${cleanVal}'`;
            }).join(", ");

            try {
              await db.execute(sql.raw(`INSERT INTO "${safeTableName}" (${columnNames}) VALUES (${values})`));
              importedCount++;
            } catch (err) {
              console.error(`Row insert error for ${tableName}:`, err);
            }
          }

          if (importedCount > 0) {
            const [dataset] = await db.insert(biDatasets).values({
              userId: req.user!.id,
              name: tableName,
              description: `Importado de SQL: ${importedCount} registros`,
              queryType: "table",
              tableName: safeTableName,
              columns: JSON.stringify(parsed.headers.map((h: string) => ({
                originalName: h,
                name: h.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase(),
                type: "text",
              }))),
            }).returning();

            results.push({ table: tableName, pgTable: safeTableName, rows: importedCount, datasetId: dataset.id });
          }
        } else {
          const structure = parseMySQLCreateTable(content, tableName);
          if (structure && structure.columns.length > 0) {
            const hasIdColumn = structure.columns.some(col => col.name.toLowerCase() === 'id');
            const filteredColumns = hasIdColumn 
              ? structure.columns.filter(col => col.name.toLowerCase() !== 'id')
              : structure.columns;
            
            const columns = filteredColumns.map((col) => {
              const safeName = col.name.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
              return `"${safeName}" ${col.type}`;
            });

            await db.execute(sql.raw(`DROP TABLE IF EXISTS "${safeTableName}"`));
            const createSql = hasIdColumn
              ? `CREATE TABLE "${safeTableName}" (id SERIAL PRIMARY KEY, ${columns.join(", ")})`
              : `CREATE TABLE "${safeTableName}" (id SERIAL PRIMARY KEY, ${columns.join(", ")})`
            await db.execute(sql.raw(createSql));

            const [dataset] = await db.insert(biDatasets).values({
              userId: req.user!.id,
              name: tableName,
              description: `Estrutura importada de SQL (tabela vazia)`,
              queryType: "table",
              tableName: safeTableName,
              columns: JSON.stringify(structure.columns.map((col) => ({
                originalName: col.name,
                name: col.name.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase(),
                type: col.type.toLowerCase(),
              }))),
            }).returning();

            results.push({ table: tableName, pgTable: safeTableName, rows: 0, datasetId: dataset.id, structureOnly: true });
          }
        }
      }

      try {
        fs.unlinkSync(filepath);
      } catch {}

      res.json({
        success: true,
        imported: results,
        totalTables: results.length,
        totalRows: results.reduce((sum, r) => sum + r.rows, 0),
      });
    } catch (error: any) {
      console.error("SQL import error:", error);
      res.status(500).json({ error: error.message || "Falha na importação do SQL" });
    }
  });

  app.post("/api/bi/upload/import", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { filepath, tableName, headers, fileType } = req.body;
      
      if (!filepath || !tableName || !headers || !Array.isArray(headers)) {
        return res.status(400).json({ error: "Dados inválidos" });
      }

      if (!fs.existsSync(filepath)) {
        return res.status(400).json({ error: "Arquivo não encontrado" });
      }

      const safeTableName = tableName.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
      
      let rows: any[] = [];
      const ext = fileType || path.extname(filepath).toLowerCase();
      
      if (ext === ".xlsx" || ext === ".xls") {
        const parsed = parseExcel(filepath);
        rows = parsed.rows;
        console.log(`[Excel Import] Parsed ${rows.length} rows with ${parsed.headers.length} columns`);
      } else if (ext === ".json") {
        const content = fs.readFileSync(filepath, "utf-8");
        const parsed = parseJSON(content);
        rows = parsed.rows;
      } else {
        const content = fs.readFileSync(filepath, "utf-8");
        const parsed = parseCSV(content);
        rows = parsed.rows;
      }

      if (rows.length === 0) {
        return res.status(400).json({ error: "Arquivo vazio ou formato inválido" });
      }

      const validHeaders = headers.filter((h: any) => h.name && h.name.trim() !== "");
      
      if (validHeaders.length === 0) {
        return res.status(400).json({ error: "Nenhuma coluna válida encontrada" });
      }

      const columns = validHeaders.map((h: any) => {
        const safeName = h.name.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase() || `col_${Date.now()}`;
        const type = h.type === "integer" ? "INTEGER" : h.type === "decimal" ? "DECIMAL(15,2)" : "TEXT";
        return `"${safeName}" ${type}`;
      });

      const fullTableName = `uploaded_${safeTableName}`;
      await db.execute(sql.raw(`DROP TABLE IF EXISTS "${fullTableName}"`));
      await db.execute(sql.raw(`CREATE TABLE "${fullTableName}" (id SERIAL PRIMARY KEY, ${columns.join(", ")})`));

      const columnNames = validHeaders.map((h: any) => 
        `"${h.name.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase()}"`
      ).join(", ");

      let importedCount = 0;
      const batchSize = 100;
      
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        
        for (const row of batch) {
          const values = validHeaders.map((h: any) => {
            const val = row[h.originalName] || row[h.name] || "";
            if (h.type === "integer") {
              const num = parseInt(String(val).replace(/[^\d-]/g, ""));
              return isNaN(num) ? 0 : num;
            }
            if (h.type === "decimal") {
              const num = parseFloat(String(val).replace(/[^\d.-]/g, ""));
              return isNaN(num) ? 0 : num;
            }
            return String(val).replace(/'/g, "''");
          });

          const valuesList = values.map((v, idx) => {
            const h = validHeaders[idx];
            if (h.type === "integer" || h.type === "decimal") {
              return v;
            }
            return `'${v}'`;
          }).join(", ");

          try {
            await db.execute(sql.raw(`INSERT INTO "${fullTableName}" (${columnNames}) VALUES (${valuesList})`));
            importedCount++;
          } catch (err) {
            console.error("Row insert error:", err);
          }
        }
      }

      const [dataset] = await db.insert(biDatasets).values({
        userId: req.user!.id,
        name: `Dados: ${tableName}`,
        description: `Importado de arquivo: ${importedCount} registros`,
        queryType: "table",
        tableName: fullTableName,
        columns: JSON.stringify(validHeaders),
      }).returning();

      try {
        fs.unlinkSync(filepath);
      } catch {}

      res.json({
        success: true,
        tableName: fullTableName,
        rowsImported: importedCount,
        datasetId: dataset.id,
      });
    } catch (error: any) {
      console.error("Import error:", error);
      res.status(500).json({ error: error.message || "Falha na importação" });
    }
  });

  app.get("/api/bi/uploaded-files", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const result = await db.execute(sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name LIKE 'uploaded_%'
        ORDER BY table_name
      `);
      
      res.json(result.rows.map((r: any) => r.table_name));
    } catch (error) {
      console.error("Get uploaded files error:", error);
      res.status(500).json({ error: "Failed to get uploaded files" });
    }
  });
}
