/**
 * Arcadia Suite - GitHub Integration Service (Expandido)
 * 
 * Este serviço fornece funcionalidades para:
 * 1. Fazer commits automáticos no repositório do Arcadia Suite
 * 2. LER repositórios externos (como n8n, OpenManus, etc.) para análise e implementação
 * 
 * @author Arcadia Development Team
 * @version 2.0.0
 */

import { Octokit } from "@octokit/rest";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const ARCADIA_OWNER = process.env.GITHUB_OWNER || "jonaspachecoometas";
const ARCADIA_REPO = process.env.GITHUB_REPO || "arcadiasuite";
const DEFAULT_BRANCH = process.env.GITHUB_DEFAULT_BRANCH || "main";

interface FileContent {
  path: string;
  content: string;
  size: number;
  type: "file" | "dir";
}

interface RepositoryStructure {
  owner: string;
  repo: string;
  branch: string;
  tree: TreeItem[];
  totalFiles: number;
  totalDirs: number;
}

interface TreeItem {
  path: string;
  type: "blob" | "tree";
  size?: number;
}

interface AnalysisResult {
  success: boolean;
  repository: string;
  structure?: RepositoryStructure;
  files?: FileContent[];
  summary?: string;
  error?: string;
}

interface FileToCommit {
  path: string;
  content: string;
}

interface CommitResult {
  success: boolean;
  commitSha?: string;
  commitUrl?: string;
  message: string;
}

interface BranchResult {
  success: boolean;
  branchName?: string;
  message: string;
}

interface PullRequestResult {
  success: boolean;
  prNumber?: number;
  prUrl?: string;
  message: string;
}

export async function getRepositoryStructure(
  owner: string,
  repo: string,
  branch?: string
): Promise<RepositoryStructure> {
  if (!branch) {
    const { data: repoData } = await octokit.repos.get({ owner, repo });
    branch = repoData.default_branch;
  }

  const { data: refData } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`,
  });

  const { data: commitData } = await octokit.git.getCommit({
    owner,
    repo,
    commit_sha: refData.object.sha,
  });

  const { data: treeData } = await octokit.git.getTree({
    owner,
    repo,
    tree_sha: commitData.tree.sha,
    recursive: "true",
  });

  const tree: TreeItem[] = treeData.tree.map((item) => ({
    path: item.path || "",
    type: item.type as "blob" | "tree",
    size: item.size,
  }));

  return {
    owner,
    repo,
    branch,
    tree,
    totalFiles: tree.filter((t) => t.type === "blob").length,
    totalDirs: tree.filter((t) => t.type === "tree").length,
  };
}

export async function readExternalFile(
  owner: string,
  repo: string,
  path: string,
  branch?: string
): Promise<string | null> {
  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path,
      ref: branch,
    });

    if ("content" in data && data.content) {
      return Buffer.from(data.content, "base64").toString("utf-8");
    }

    return null;
  } catch {
    return null;
  }
}

export async function readMultipleFiles(
  owner: string,
  repo: string,
  paths: string[],
  branch?: string
): Promise<FileContent[]> {
  const results: FileContent[] = [];

  for (const path of paths) {
    const content = await readExternalFile(owner, repo, path, branch);
    if (content !== null) {
      results.push({
        path,
        content,
        size: content.length,
        type: "file",
      });
    }
  }

  return results;
}

export async function listDirectory(
  owner: string,
  repo: string,
  dirPath: string,
  branch?: string
): Promise<{ name: string; path: string; type: "file" | "dir" }[]> {
  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path: dirPath,
      ref: branch,
    });

    if (Array.isArray(data)) {
      return data.map((item) => ({
        name: item.name,
        path: item.path,
        type: item.type === "dir" ? "dir" : "file",
      }));
    }

    return [];
  } catch {
    return [];
  }
}

export async function searchFiles(
  owner: string,
  repo: string,
  pattern: string,
  branch?: string
): Promise<string[]> {
  const structure = await getRepositoryStructure(owner, repo, branch);

  return structure.tree
    .filter((item) => item.type === "blob" && item.path.includes(pattern))
    .map((item) => item.path);
}

export async function analyzeRepository(
  owner: string,
  repo: string,
  focusPaths?: string[]
): Promise<AnalysisResult> {
  try {
    const structure = await getRepositoryStructure(owner, repo);

    let files: FileContent[] = [];
    if (focusPaths && focusPaths.length > 0) {
      for (const focusPath of focusPaths) {
        const matchingFiles = structure.tree
          .filter((item) => item.type === "blob" && item.path.startsWith(focusPath))
          .slice(0, 20);

        for (const file of matchingFiles) {
          const content = await readExternalFile(owner, repo, file.path, structure.branch);
          if (content) {
            files.push({
              path: file.path,
              content,
              size: content.length,
              type: "file",
            });
          }
        }
      }
    }

    const summary = generateRepositorySummary(structure, files);

    return {
      success: true,
      repository: `${owner}/${repo}`,
      structure,
      files,
      summary,
    };
  } catch (error: any) {
    return {
      success: false,
      repository: `${owner}/${repo}`,
      error: error.message,
    };
  }
}

function generateRepositorySummary(structure: RepositoryStructure, files: FileContent[]): string {
  const lines: string[] = [];

  lines.push(`## Análise do Repositório: ${structure.owner}/${structure.repo}`);
  lines.push(`**Branch:** ${structure.branch}`);
  lines.push(`**Total de Arquivos:** ${structure.totalFiles}`);
  lines.push(`**Total de Diretórios:** ${structure.totalDirs}`);
  lines.push("");

  const hasPackageJson = structure.tree.some((t) => t.path === "package.json");
  const hasRequirements = structure.tree.some((t) => t.path === "requirements.txt");
  const hasTsConfig = structure.tree.some((t) => t.path.includes("tsconfig.json"));

  lines.push("### Tecnologias Detectadas:");
  if (hasPackageJson) lines.push("- Node.js / JavaScript");
  if (hasTsConfig) lines.push("- TypeScript");
  if (hasRequirements) lines.push("- Python");
  lines.push("");

  const topLevelDirs = Array.from(new Set(structure.tree.map((t) => t.path.split("/")[0]))).slice(0, 15);
  lines.push("### Estrutura Principal:");
  topLevelDirs.forEach((dir) => lines.push(`- ${dir}/`));
  lines.push("");

  if (files.length > 0) {
    lines.push(`### Arquivos Analisados (${files.length}):`);
    files.forEach((f) => lines.push(`- ${f.path} (${f.size} bytes)`));
  }

  return lines.join("\n");
}

async function getCurrentCommit(owner: string, repo: string, branch: string) {
  const { data: refData } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`,
  });

  const commitSha = refData.object.sha;

  const { data: commitData } = await octokit.git.getCommit({
    owner,
    repo,
    commit_sha: commitSha,
  });

  return { commitSha, treeSha: commitData.tree.sha };
}

export async function commitFiles(
  files: FileToCommit[],
  message: string,
  branch: string = DEFAULT_BRANCH
): Promise<CommitResult> {
  try {
    const { commitSha, treeSha } = await getCurrentCommit(ARCADIA_OWNER, ARCADIA_REPO, branch);

    const blobs: { sha: string; path: string }[] = [];
    for (const file of files) {
      const { data } = await octokit.git.createBlob({
        owner: ARCADIA_OWNER,
        repo: ARCADIA_REPO,
        content: file.content,
        encoding: "utf-8",
      });
      blobs.push({ sha: data.sha, path: file.path });
    }

    const tree = blobs.map(({ sha, path }) => ({
      path,
      mode: "100644" as const,
      type: "blob" as const,
      sha,
    }));

    const { data: newTree } = await octokit.git.createTree({
      owner: ARCADIA_OWNER,
      repo: ARCADIA_REPO,
      tree,
      base_tree: treeSha,
    });

    const { data: newCommit } = await octokit.git.createCommit({
      owner: ARCADIA_OWNER,
      repo: ARCADIA_REPO,
      message,
      tree: newTree.sha,
      parents: [commitSha],
    });

    await octokit.git.updateRef({
      owner: ARCADIA_OWNER,
      repo: ARCADIA_REPO,
      ref: `heads/${branch}`,
      sha: newCommit.sha,
    });

    return {
      success: true,
      commitSha: newCommit.sha,
      commitUrl: `https://github.com/${ARCADIA_OWNER}/${ARCADIA_REPO}/commit/${newCommit.sha}`,
      message: `Commit realizado: ${message}`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Erro ao fazer commit: ${error.message}`,
    };
  }
}

export async function createBranch(
  newBranchName: string,
  sourceBranch: string = DEFAULT_BRANCH
): Promise<BranchResult> {
  try {
    const { data: refData } = await octokit.git.getRef({
      owner: ARCADIA_OWNER,
      repo: ARCADIA_REPO,
      ref: `heads/${sourceBranch}`,
    });

    await octokit.git.createRef({
      owner: ARCADIA_OWNER,
      repo: ARCADIA_REPO,
      ref: `refs/heads/${newBranchName}`,
      sha: refData.object.sha,
    });

    return {
      success: true,
      branchName: newBranchName,
      message: `Branch '${newBranchName}' criada com sucesso a partir de '${sourceBranch}'`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Erro ao criar branch: ${error.message}`,
    };
  }
}

export async function createPullRequest(
  title: string,
  body: string,
  headBranch: string,
  baseBranch: string = DEFAULT_BRANCH
): Promise<PullRequestResult> {
  try {
    const { data } = await octokit.pulls.create({
      owner: ARCADIA_OWNER,
      repo: ARCADIA_REPO,
      title,
      body,
      head: headBranch,
      base: baseBranch,
    });

    return {
      success: true,
      prNumber: data.number,
      prUrl: data.html_url,
      message: `Pull Request #${data.number} criado com sucesso`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Erro ao criar Pull Request: ${error.message}`,
    };
  }
}

export async function getRepositoryInfo(): Promise<{
  name: string;
  fullName: string;
  defaultBranch: string;
  url: string;
}> {
  const { data } = await octokit.repos.get({
    owner: ARCADIA_OWNER,
    repo: ARCADIA_REPO,
  });

  return {
    name: data.name,
    fullName: data.full_name,
    defaultBranch: data.default_branch,
    url: data.html_url,
  };
}

export async function listBranches(): Promise<string[]> {
  const { data } = await octokit.repos.listBranches({
    owner: ARCADIA_OWNER,
    repo: ARCADIA_REPO,
  });

  return data.map((branch) => branch.name);
}

export async function getFileContent(
  filePath: string,
  branch: string = DEFAULT_BRANCH
): Promise<string | null> {
  try {
    const { data } = await octokit.repos.getContent({
      owner: ARCADIA_OWNER,
      repo: ARCADIA_REPO,
      path: filePath,
      ref: branch,
    });

    if ("content" in data && data.content) {
      return Buffer.from(data.content, "base64").toString("utf-8");
    }

    return null;
  } catch {
    return null;
  }
}

export async function toolGitHubCommit(
  message: string,
  files: { path: string; content: string }[]
): Promise<{ success: boolean; result: string }> {
  const result = await commitFiles(files, message);

  return {
    success: result.success,
    result: result.success
      ? `✅ Commit realizado: ${result.commitUrl}`
      : `❌ Erro: ${result.message}`,
  };
}

export async function toolAnalyzeExternalRepo(
  repoUrl: string,
  focusPaths?: string[]
): Promise<{ success: boolean; result: string; data?: AnalysisResult }> {
  const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) {
    return {
      success: false,
      result: "URL inválida. Use o formato: https://github.com/owner/repo",
    };
  }

  const [, owner, repo] = match;
  const cleanRepo = repo.replace(/\.git$/, "");

  const analysis = await analyzeRepository(owner, cleanRepo, focusPaths);

  return {
    success: analysis.success,
    result: analysis.success
      ? `✅ Repositório analisado: ${analysis.repository}\n\n${analysis.summary}`
      : `❌ Erro: ${analysis.error}`,
    data: analysis,
  };
}

export async function toolReadExternalFile(
  repoUrl: string,
  filePath: string
): Promise<{ success: boolean; result: string; content?: string }> {
  const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) {
    return {
      success: false,
      result: "URL inválida. Use o formato: https://github.com/owner/repo",
    };
  }

  const [, owner, repo] = match;
  const cleanRepo = repo.replace(/\.git$/, "");

  const content = await readExternalFile(owner, cleanRepo, filePath);

  if (content) {
    return {
      success: true,
      result: `✅ Arquivo lido: ${filePath} (${content.length} bytes)`,
      content,
    };
  } else {
    return {
      success: false,
      result: `❌ Arquivo não encontrado: ${filePath}`,
    };
  }
}

export default {
  getRepositoryStructure,
  readExternalFile,
  readMultipleFiles,
  listDirectory,
  searchFiles,
  analyzeRepository,
  commitFiles,
  createBranch,
  createPullRequest,
  getRepositoryInfo,
  listBranches,
  getFileContent,
  toolGitHubCommit,
  toolAnalyzeExternalRepo,
  toolReadExternalFile,
};
