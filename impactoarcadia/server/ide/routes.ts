import { Router, Request, Response, NextFunction } from "express";
import * as fs from "fs/promises";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import OpenAI from "openai";
import { manusService } from "../manus/service";

const execAsync = promisify(exec);
const router = Router();

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
}

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const ALLOWED_DIRS = ["python-service", "server", "client/src", "shared"];
const BLOCKED_COMMANDS = ["rm -rf", "rm -r /", "mkfs", "dd if=", ":(){ :|:& };:"];

interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

async function buildFileTree(dirPath: string, relativePath: string = ""): Promise<FileNode[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const nodes: FileNode[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "__pycache__") {
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);
    const relPath = path.join(relativePath, entry.name);

    if (entry.isDirectory()) {
      const children = await buildFileTree(fullPath, relPath);
      nodes.push({
        name: entry.name,
        path: relPath,
        type: "directory",
        children,
      });
    } else {
      nodes.push({
        name: entry.name,
        path: relPath,
        type: "file",
      });
    }
  }

  return nodes.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === "directory" ? -1 : 1;
  });
}

router.get("/files", requireAuth, async (req, res) => {
  try {
    const allFiles: FileNode[] = [];
    
    for (const dir of ALLOWED_DIRS) {
      try {
        const dirPath = path.resolve(process.cwd(), dir);
        const children = await buildFileTree(dirPath, dir);
        allFiles.push({
          name: dir,
          path: dir,
          type: "directory",
          children,
        });
      } catch (e) {
      }
    }

    res.json(allFiles);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/file", requireAuth, async (req, res) => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) {
      return res.status(400).json({ error: "Path required" });
    }

    const isAllowed = ALLOWED_DIRS.some(dir => filePath.startsWith(dir));
    if (!isAllowed || filePath.includes("..")) {
      return res.status(403).json({ error: "Access denied" });
    }

    const fullPath = path.resolve(process.cwd(), filePath);
    const content = await fs.readFile(fullPath, "utf-8");
    res.type("text/plain").send(content);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/file", requireAuth, async (req, res) => {
  try {
    const { path: filePath, content } = req.body;
    if (!filePath || content === undefined) {
      return res.status(400).json({ error: "Path and content required" });
    }

    const isAllowed = ALLOWED_DIRS.some(dir => filePath.startsWith(dir));
    if (!isAllowed || filePath.includes("..")) {
      return res.status(403).json({ error: "Access denied" });
    }

    const fullPath = path.resolve(process.cwd(), filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, "utf-8");
    res.json({ success: true, path: filePath });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/execute", requireAuth, async (req, res) => {
  try {
    const { command } = req.body;
    if (!command) {
      return res.status(400).json({ error: "Command required" });
    }

    if (BLOCKED_COMMANDS.some(bc => command.includes(bc))) {
      return res.status(403).json({ error: "Comando bloqueado por segurança" });
    }

    const { stdout, stderr } = await execAsync(command, { timeout: 30000 });
    res.json({ 
      success: true, 
      command, 
      output: stdout, 
      error: stderr 
    });
  } catch (error: any) {
    res.json({ 
      success: false, 
      command: req.body.command,
      error: error.message 
    });
  }
});

router.post("/ai-generate", requireAuth, async (req, res) => {
  try {
    const { prompt, currentFile, currentContent } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt required" });
    }

    const systemPrompt = `Você é um assistente de programação especializado. Gere código limpo, bem documentado e funcional.
Se um arquivo atual foi fornecido, considere seu contexto ao gerar o código.
Responda APENAS com o código, sem explicações adicionais.`;

    const userPrompt = currentFile 
      ? `Arquivo atual: ${currentFile}\n\nConteúdo atual:\n${currentContent?.substring(0, 2000)}\n\nSolicitação: ${prompt}`
      : prompt;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 2000,
      temperature: 0.3,
    });

    const generatedCode = response.choices[0]?.message?.content || "";
    
    const codeMatch = generatedCode.match(/```[\w]*\n?([\s\S]*?)```/);
    const code = codeMatch ? codeMatch[1].trim() : generatedCode.trim();

    res.json({ success: true, code });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/ai-chat", requireAuth, async (req, res) => {
  try {
    const { message, currentFile, currentContent } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message required" });
    }

    const systemPrompt = `Você é o Manus, assistente de desenvolvimento do IDE Arcádia Suite.
Você ajuda desenvolvedores com:
- Explicação e análise de código
- Geração de código sob demanda
- Debug e correção de erros  
- Refatoração e melhorias
- Criação de testes
- Documentação

CAPACIDADES ESPECIAIS:
- Você pode gerar código Python, JavaScript, TypeScript
- Você entende o contexto do projeto Arcádia Suite (Frappe-like, multi-tenant)
- Você pode sugerir criação de novos arquivos

FORMATO DE RESPOSTA:
- Seja direto e prático
- Use blocos de código quando apropriado
- Se gerar código, use markdown: \`\`\`python ou \`\`\`typescript
- Se sugerir criar arquivo, indique: [CRIAR ARQUIVO: caminho/nome.ext]

Use português brasileiro.`;

    const userPrompt = currentFile 
      ? `[Contexto: Editando ${currentFile}]\n\nCódigo atual:\n\`\`\`\n${currentContent?.substring(0, 2000)}\n\`\`\`\n\nSolicitação: ${message}`
      : message;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 2000,
      temperature: 0.3,
    });

    const aiResponse = response.choices[0]?.message?.content || "Desculpe, não consegui processar sua solicitação.";
    res.json({ success: true, response: aiResponse });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/create-file", requireAuth, async (req, res) => {
  try {
    const { filePath, content = "" } = req.body;
    if (!filePath) {
      return res.status(400).json({ error: "File path required" });
    }

    const isAllowed = ALLOWED_DIRS.some(dir => filePath.startsWith(dir));
    if (!isAllowed || filePath.includes("..")) {
      return res.status(403).json({ error: "Access denied" });
    }

    const fullPath = path.resolve(process.cwd(), filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, "utf-8");
    res.json({ success: true, path: filePath });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/create-folder", requireAuth, async (req, res) => {
  try {
    const { folderPath } = req.body;
    if (!folderPath) {
      return res.status(400).json({ error: "Folder path required" });
    }

    const isAllowed = ALLOWED_DIRS.some(dir => folderPath.startsWith(dir));
    if (!isAllowed || folderPath.includes("..")) {
      return res.status(403).json({ error: "Access denied" });
    }

    const fullPath = path.resolve(process.cwd(), folderPath);
    await fs.mkdir(fullPath, { recursive: true });
    res.json({ success: true, path: folderPath });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/file", requireAuth, async (req, res) => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) {
      return res.status(400).json({ error: "Path required" });
    }

    const isAllowed = ALLOWED_DIRS.some(dir => filePath.startsWith(dir));
    if (!isAllowed || filePath.includes("..")) {
      return res.status(403).json({ error: "Access denied" });
    }

    const fullPath = path.resolve(process.cwd(), filePath);
    await fs.unlink(fullPath);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/run-python", requireAuth, async (req, res) => {
  try {
    const { filePath, args = "" } = req.body;
    if (!filePath) {
      return res.status(400).json({ error: "File path required" });
    }

    const isAllowed = ALLOWED_DIRS.some(dir => filePath.startsWith(dir));
    if (!isAllowed || !filePath.endsWith(".py")) {
      return res.status(403).json({ error: "Invalid Python file" });
    }

    const fullPath = path.resolve(process.cwd(), filePath);
    const { stdout, stderr } = await execAsync(`python3 ${fullPath} ${args}`, { timeout: 60000 });
    res.json({ 
      success: true, 
      output: stdout, 
      error: stderr,
      language: "python"
    });
  } catch (error: any) {
    res.json({ 
      success: false, 
      error: error.message,
      language: "python"
    });
  }
});

router.post("/run-node", requireAuth, async (req, res) => {
  try {
    const { filePath, args = "" } = req.body;
    if (!filePath) {
      return res.status(400).json({ error: "File path required" });
    }

    const isAllowed = ALLOWED_DIRS.some(dir => filePath.startsWith(dir));
    const validExtensions = [".js", ".ts", ".mjs"];
    if (!isAllowed || !validExtensions.some(ext => filePath.endsWith(ext))) {
      return res.status(403).json({ error: "Invalid JavaScript/TypeScript file" });
    }

    const command = filePath.endsWith(".ts") 
      ? `npx tsx ${filePath} ${args}`
      : `node ${filePath} ${args}`;

    const { stdout, stderr } = await execAsync(command, { timeout: 60000, cwd: process.cwd() });
    res.json({ 
      success: true, 
      output: stdout, 
      error: stderr,
      language: "javascript"
    });
  } catch (error: any) {
    res.json({ 
      success: false, 
      error: error.message,
      language: "javascript"
    });
  }
});

router.post("/ai-agent", requireAuth, async (req: any, res) => {
  try {
    const { task, currentFile, currentContent } = req.body;
    if (!task) {
      return res.status(400).json({ error: "Task required" });
    }

    const userId = req.user?.id?.toString() || "ide-user";
    
    const contextualTask = currentFile 
      ? `[IDE] Trabalhando no arquivo ${currentFile}. Tarefa: ${task}\n\nConteúdo atual do arquivo:\n${currentContent?.substring(0, 2000)}`
      : `[IDE] ${task}`;

    const { runId } = await manusService.run(userId, contextualTask);
    
    res.json({ 
      success: true, 
      runId,
      message: "Manus está executando a tarefa. Acompanhe o progresso."
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/manus-task", requireAuth, async (req: any, res) => {
  try {
    const { task } = req.body;
    if (!task) {
      return res.status(400).json({ error: "Task required" });
    }

    const userId = req.user?.id?.toString() || "ide-user";
    const { runId } = await manusService.run(userId, task);
    
    res.json({ 
      success: true, 
      runId,
      status: "running",
      message: "Tarefa iniciada pelo Manus."
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/project-structure", requireAuth, async (req, res) => {
  try {
    const structure: string[] = [];
    
    const walkDir = async (dir: string, prefix: string = "") => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "__pycache__") {
            continue;
          }
          const fullPath = path.join(dir, entry.name);
          structure.push(`${prefix}${entry.isDirectory() ? "📁" : "📄"} ${entry.name}`);
          if (entry.isDirectory() && prefix.length < 8) {
            await walkDir(fullPath, prefix + "  ");
          }
        }
      } catch {}
    };

    for (const dir of ALLOWED_DIRS) {
      structure.push(`📂 ${dir}/`);
      await walkDir(path.resolve(process.cwd(), dir), "  ");
    }

    res.json({ structure: structure.join("\n") });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
