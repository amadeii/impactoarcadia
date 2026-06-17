/**
 * Arcadia Suite - GitHub Integration Routes
 * 
 * Rotas da API para expor as funcionalidades de integração com GitHub.
 * Rotas de escrita (commit, branch, PR) requerem autenticação admin.
 * 
 * @author Arcadia Development Team
 * @version 2.0.0
 */

import { Router, Request, Response, NextFunction } from "express";
import githubService from "./service";

const router = Router();

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({
      success: false,
      error: "Autenticação necessária",
    });
  }
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({
      success: false,
      error: "Autenticação necessária",
    });
  }
  if ((req.user as any)?.role !== "admin") {
    return res.status(403).json({
      success: false,
      error: "Permissão negada. Apenas administradores.",
    });
  }
  next();
}

function checkGitHubConfig(req: Request, res: Response, next: NextFunction) {
  if (!process.env.GITHUB_TOKEN) {
    return res.status(500).json({
      success: false,
      error: "GITHUB_TOKEN não configurado. Configure nas variáveis de ambiente.",
    });
  }
  next();
}

router.post("/commit", requireAdmin, checkGitHubConfig, async (req: Request, res: Response) => {
  try {
    const { message, files, branch } = req.body;

    if (!message || !files || !Array.isArray(files)) {
      return res.status(400).json({
        success: false,
        error: "Parâmetros inválidos. Requer 'message' e 'files' (array).",
      });
    }

    const result = await githubService.commitFiles(files, message, branch);

    if (result.success) {
      return res.json({
        success: true,
        commitSha: result.commitSha,
        commitUrl: result.commitUrl,
        message: result.message,
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.message,
      });
    }
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/branch", requireAdmin, checkGitHubConfig, async (req: Request, res: Response) => {
  try {
    const { name, source } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: "Parâmetro 'name' é obrigatório.",
      });
    }

    const result = await githubService.createBranch(name, source);

    if (result.success) {
      return res.json({
        success: true,
        branchName: result.branchName,
        message: result.message,
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.message,
      });
    }
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/pull-request", requireAdmin, checkGitHubConfig, async (req: Request, res: Response) => {
  try {
    const { title, body, head, base } = req.body;

    if (!title || !body || !head) {
      return res.status(400).json({
        success: false,
        error: "Parâmetros 'title', 'body' e 'head' são obrigatórios.",
      });
    }

    const result = await githubService.createPullRequest(title, body, head, base);

    if (result.success) {
      return res.json({
        success: true,
        prNumber: result.prNumber,
        prUrl: result.prUrl,
        message: result.message,
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.message,
      });
    }
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/info", async (_req: Request, res: Response) => {
  try {
    const info = await githubService.getRepositoryInfo();
    return res.json({
      success: true,
      repository: info,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/branches", async (_req: Request, res: Response) => {
  try {
    const branches = await githubService.listBranches();
    return res.json({
      success: true,
      branches,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/file", async (req: Request, res: Response) => {
  try {
    const { path, branch } = req.query;

    if (!path || typeof path !== "string") {
      return res.status(400).json({
        success: false,
        error: "Parâmetro 'path' é obrigatório.",
      });
    }

    const content = await githubService.getFileContent(
      path,
      typeof branch === "string" ? branch : undefined
    );

    if (content !== null) {
      return res.json({
        success: true,
        path,
        content,
      });
    } else {
      return res.status(404).json({
        success: false,
        error: "Arquivo não encontrado.",
      });
    }
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/analyze", async (req: Request, res: Response) => {
  try {
    const { repoUrl, focusPaths } = req.body;

    if (!repoUrl) {
      return res.status(400).json({
        success: false,
        error: "Parâmetro 'repoUrl' é obrigatório.",
      });
    }

    const result = await githubService.toolAnalyzeExternalRepo(repoUrl, focusPaths);

    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/read-external", async (req: Request, res: Response) => {
  try {
    const { repoUrl, filePath } = req.body;

    if (!repoUrl || !filePath) {
      return res.status(400).json({
        success: false,
        error: "Parâmetros 'repoUrl' e 'filePath' são obrigatórios.",
      });
    }

    const result = await githubService.toolReadExternalFile(repoUrl, filePath);

    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/external/structure", async (req: Request, res: Response) => {
  try {
    const { owner, repo, branch } = req.query;

    if (!owner || !repo) {
      return res.status(400).json({
        success: false,
        error: "Parâmetros 'owner' e 'repo' são obrigatórios.",
      });
    }

    const structure = await githubService.getRepositoryStructure(
      owner as string,
      repo as string,
      branch as string | undefined
    );

    return res.json({
      success: true,
      structure,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/external/directory", async (req: Request, res: Response) => {
  try {
    const { owner, repo, path, branch } = req.query;

    if (!owner || !repo || !path) {
      return res.status(400).json({
        success: false,
        error: "Parâmetros 'owner', 'repo' e 'path' são obrigatórios.",
      });
    }

    const items = await githubService.listDirectory(
      owner as string,
      repo as string,
      path as string,
      branch as string | undefined
    );

    return res.json({
      success: true,
      items,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/external/search", async (req: Request, res: Response) => {
  try {
    const { owner, repo, pattern, branch } = req.query;

    if (!owner || !repo || !pattern) {
      return res.status(400).json({
        success: false,
        error: "Parâmetros 'owner', 'repo' e 'pattern' são obrigatórios.",
      });
    }

    const files = await githubService.searchFiles(
      owner as string,
      repo as string,
      pattern as string,
      branch as string | undefined
    );

    return res.json({
      success: true,
      files,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
