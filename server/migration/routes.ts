import { Router } from 'express';
import multer from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { db } from '../../db';
import { migrationJobs, migrationMappings, migrationLogs, migrationTemplates } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { analyzeBackupDirectory, getCollectionDocuments, defaultMappings, parseBsonFile } from './bson-parser';
import { importToDatabase, getImportableEntities } from './importer';

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
}

function isPathSafe(extractPath: string, filePath: string): boolean {
  const resolvedPath = path.resolve(extractPath, filePath);
  return resolvedPath.startsWith(path.resolve(extractPath));
}

async function cleanupJob(jobId: number) {
  const extractDir = path.join(UPLOAD_DIR, `job-${jobId}`);
  if (fs.existsSync(extractDir)) {
    fs.rmSync(extractDir, { recursive: true, force: true });
  }
}

const execAsync = promisify(exec);
const router = Router();

const UPLOAD_DIR = '/tmp/migrations';

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const safeName = sanitizeFilename(file.originalname);
    cb(null, `${uniqueSuffix}-${safeName}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
});

router.get('/jobs', async (_req, res) => {
  try {
    const jobs = await db.select().from(migrationJobs).orderBy(desc(migrationJobs.createdAt));
    res.json(jobs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/jobs/:id', async (req, res) => {
  try {
    const [job] = await db.select().from(migrationJobs).where(eq(migrationJobs.id, parseInt(req.params.id)));
    if (!job) return res.status(404).json({ error: 'Job not found' });
    
    const mappings = await db.select().from(migrationMappings).where(eq(migrationMappings.jobId, job.id));
    const logs = await db.select().from(migrationLogs)
      .where(eq(migrationLogs.jobId, job.id))
      .orderBy(desc(migrationLogs.createdAt))
      .limit(100);
    
    res.json({ ...job, mappings, logs });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { name, sourceSystem, tenantId } = req.body;
    const filePath = req.file.path;
    const fileName = req.file.originalname;
    const fileSize = req.file.size;

    let sourceType = 'unknown';
    if (fileName.endsWith('.zip')) sourceType = 'mongodb';
    else if (fileName.endsWith('.json')) sourceType = 'json';
    else if (fileName.endsWith('.csv')) sourceType = 'csv';

    const [job] = await db.insert(migrationJobs).values({
      name: name || `Migração ${new Date().toLocaleDateString('pt-BR')}`,
      sourceType,
      sourceSystem: sourceSystem || 'Sistema Legado',
      status: 'pending',
      fileName,
      fileSize,
      tenantId: tenantId ? parseInt(tenantId) : null,
      createdBy: 'admin'
    }).returning();

    if (sourceType === 'mongodb' && fileName.endsWith('.zip')) {
      const extractDir = path.join(UPLOAD_DIR, `job-${job.id}`);
      fs.mkdirSync(extractDir, { recursive: true });

      await execAsync(`unzip -o "${filePath}" -d "${extractDir}"`);

      const subdirs = fs.readdirSync(extractDir).filter(f => 
        fs.statSync(path.join(extractDir, f)).isDirectory() && 
        fs.readdirSync(path.join(extractDir, f)).some(sf => sf.endsWith('.bson'))
      );

      const bsonDir = subdirs.length > 0 
        ? path.join(extractDir, subdirs[0])
        : extractDir;

      await db.update(migrationJobs)
        .set({ 
          status: 'analyzing',
          importConfig: { extractPath: bsonDir }
        })
        .where(eq(migrationJobs.id, job.id));

      const analysis = analyzeBackupDirectory(bsonDir);
      
      await db.update(migrationJobs)
        .set({ 
          status: 'mapping',
          totalRecords: analysis.totalRecords,
          analysisResult: analysis
        })
        .where(eq(migrationJobs.id, job.id));

      for (const col of analysis.collections) {
        const mapping = defaultMappings[col.name];
        if (mapping) {
          await db.insert(migrationMappings).values({
            jobId: job.id,
            sourceEntity: col.name,
            targetEntity: mapping.target,
            fieldMappings: mapping.fields,
            isEnabled: true,
            recordCount: col.count,
            priority: col.count
          });
        }
      }
    }

    const [updatedJob] = await db.select().from(migrationJobs).where(eq(migrationJobs.id, job.id));
    res.json(updatedJob);
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/jobs/:id/analysis', async (req, res) => {
  try {
    const [job] = await db.select().from(migrationJobs).where(eq(migrationJobs.id, parseInt(req.params.id)));
    if (!job) return res.status(404).json({ error: 'Job not found' });
    
    res.json(job.analysisResult);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/jobs/:id/preview/:collection', async (req, res) => {
  try {
    const [job] = await db.select().from(migrationJobs).where(eq(migrationJobs.id, parseInt(req.params.id)));
    if (!job) return res.status(404).json({ error: 'Job not found' });
    
    const config = job.importConfig as any;
    if (!config?.extractPath) {
      return res.status(400).json({ error: 'No extract path found' });
    }

    const limit = parseInt(req.query.limit as string) || 10;
    const docs = getCollectionDocuments(config.extractPath, req.params.collection, limit);
    
    res.json({ collection: req.params.collection, documents: docs, total: docs.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/jobs/:id/mappings', async (req, res) => {
  try {
    const jobId = parseInt(req.params.id);
    const { mappings: newMappings } = req.body;

    for (const mapping of newMappings) {
      if (mapping.id) {
        await db.update(migrationMappings)
          .set({
            targetEntity: mapping.targetEntity,
            fieldMappings: mapping.fieldMappings,
            isEnabled: mapping.isEnabled,
            transformations: mapping.transformations
          })
          .where(eq(migrationMappings.id, mapping.id));
      } else {
        await db.insert(migrationMappings).values({
          jobId,
          sourceEntity: mapping.sourceEntity,
          targetEntity: mapping.targetEntity,
          fieldMappings: mapping.fieldMappings,
          isEnabled: mapping.isEnabled ?? true,
          recordCount: mapping.recordCount ?? 0
        });
      }
    }

    const updatedMappings = await db.select().from(migrationMappings).where(eq(migrationMappings.jobId, jobId));
    res.json(updatedMappings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/jobs/:id/import', async (req, res) => {
  try {
    const jobId = parseInt(req.params.id);
    const [job] = await db.select().from(migrationJobs).where(eq(migrationJobs.id, jobId));
    if (!job) return res.status(404).json({ error: 'Job not found' });

    await db.update(migrationJobs)
      .set({ status: 'importing', startedAt: new Date() })
      .where(eq(migrationJobs.id, jobId));

    const mappings = await db.select().from(migrationMappings)
      .where(eq(migrationMappings.jobId, jobId));
    
    const enabledMappings = mappings.filter(m => m.isEnabled);
    const config = job.importConfig as any;

    let totalImported = 0;
    let totalFailed = 0;

    for (const mapping of enabledMappings) {
      try {
        const docs = getCollectionDocuments(config.extractPath, mapping.sourceEntity);
        const result = await importToDatabase(
          mapping.targetEntity,
          docs,
          mapping.fieldMappings as Record<string, string>,
          jobId,
          { tenantId: job.tenantId || undefined, storeId: job.storeId || undefined }
        );

        await db.update(migrationMappings)
          .set({ importedCount: result.imported })
          .where(eq(migrationMappings.id, mapping.id));

        totalImported += result.imported;
        totalFailed += result.failed;

        await db.insert(migrationLogs).values({
          jobId,
          mappingId: mapping.id,
          level: 'success',
          message: `Imported ${result.imported}/${docs.length} records from ${mapping.sourceEntity} to ${mapping.targetEntity}`,
          details: { imported: result.imported, failed: result.failed, errors: result.errors.slice(0, 10) }
        });
      } catch (error: any) {
        await db.insert(migrationLogs).values({
          jobId,
          mappingId: mapping.id,
          level: 'error',
          message: `Failed to import ${mapping.sourceEntity}: ${error.message}`
        });
        totalFailed += mapping.recordCount || 0;
      }
    }

    await db.update(migrationJobs)
      .set({ 
        status: 'completed',
        importedRecords: totalImported,
        failedRecords: totalFailed,
        completedAt: new Date()
      })
      .where(eq(migrationJobs.id, jobId));

    const [updatedJob] = await db.select().from(migrationJobs).where(eq(migrationJobs.id, jobId));
    res.json(updatedJob);
  } catch (error: any) {
    await db.update(migrationJobs)
      .set({ status: 'failed', errorLog: error.message })
      .where(eq(migrationJobs.id, parseInt(req.params.id)));
    res.status(500).json({ error: error.message });
  }
});

router.delete('/jobs/:id', async (req, res) => {
  try {
    const jobId = parseInt(req.params.id);
    const [job] = await db.select().from(migrationJobs).where(eq(migrationJobs.id, jobId));
    
    if (job) {
      const config = job.importConfig as any;
      if (config?.extractPath && fs.existsSync(config.extractPath)) {
        fs.rmSync(path.dirname(config.extractPath), { recursive: true, force: true });
      }
    }

    await db.delete(migrationJobs).where(eq(migrationJobs.id, jobId));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/jobs/:id/reimport/:mappingId', async (req, res) => {
  try {
    const jobId = parseInt(req.params.id);
    const mappingId = parseInt(req.params.mappingId);
    
    const [job] = await db.select().from(migrationJobs).where(eq(migrationJobs.id, jobId));
    if (!job) {
      return res.status(404).json({ error: 'Job não encontrado' });
    }
    
    const [mapping] = await db.select().from(migrationMappings).where(eq(migrationMappings.id, mappingId));
    if (!mapping) {
      return res.status(404).json({ error: 'Mapeamento não encontrado' });
    }
    
    const config = job.importConfig as any;
    const docs = getCollectionDocuments(config.extractPath, mapping.sourceEntity);
    
    const result = await importToDatabase(
      mapping.targetEntity,
      docs,
      mapping.fieldMappings as Record<string, string>,
      jobId,
      { tenantId: job.tenantId || undefined, storeId: job.storeId || undefined }
    );
    
    await db.update(migrationMappings)
      .set({ importedCount: result.imported })
      .where(eq(migrationMappings.id, mappingId));
    
    await db.insert(migrationLogs).values({
      jobId,
      mappingId,
      level: result.failed > 0 ? 'warning' : 'success',
      message: `Re-importação: ${result.imported}/${docs.length} registros de ${mapping.sourceEntity} para ${mapping.targetEntity}`,
      details: { imported: result.imported, failed: result.failed, errors: result.errors.slice(0, 10) }
    });
    
    res.json({ success: true, result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/entities', async (_req, res) => {
  try {
    const entities = getImportableEntities();
    res.json(entities);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/templates', async (_req, res) => {
  try {
    const templates = await db.select().from(migrationTemplates).orderBy(desc(migrationTemplates.usageCount));
    res.json(templates);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/templates', async (req, res) => {
  try {
    const [template] = await db.insert(migrationTemplates).values(req.body).returning();
    res.json(template);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
