import { spawn, execSync, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";

let laravelProcess: ChildProcess | null = null;
const PLUS_PORT = parseInt(process.env.PLUS_PORT || "8080", 10);
const PLUS_DIR = path.resolve(process.cwd(), "plus");

function isPhpAvailable(): boolean {
  try {
    execSync("which php", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export async function startLaravelServer(): Promise<boolean> {
  if (laravelProcess && !laravelProcess.killed) {
    console.log("[Plus Launcher] Laravel já está rodando");
    return true;
  }

  if (!isPhpAvailable() || !fs.existsSync(path.join(PLUS_DIR, "artisan"))) {
    console.log("[Plus Launcher] PHP ou diretório Plus não disponível, pulando inicialização");
    return false;
  }

  return new Promise((resolve) => {
    console.log(`[Plus Launcher] Iniciando Laravel na porta ${PLUS_PORT}...`);
    
    laravelProcess = spawn("php", [
      "artisan", "serve", 
      "--host=0.0.0.0", 
      `--port=${PLUS_PORT}`
    ], {
      cwd: PLUS_DIR,
      stdio: ["ignore", "pipe", "pipe"],
      detached: false
    });

    let started = false;

    laravelProcess.stdout?.on("data", (data: Buffer) => {
      const output = data.toString();
      console.log(`[Plus] ${output.trim()}`);
      
      if (output.includes("Server running") && !started) {
        started = true;
        console.log(`[Plus Launcher] Laravel iniciado com sucesso na porta ${PLUS_PORT}`);
        resolve(true);
      }
    });

    laravelProcess.stderr?.on("data", (data: Buffer) => {
      console.error(`[Plus Error] ${data.toString().trim()}`);
    });

    laravelProcess.on("error", (err) => {
      console.error(`[Plus Launcher] Erro ao iniciar Laravel: ${err.message}`);
      laravelProcess = null;
      resolve(false);
    });

    laravelProcess.on("exit", (code) => {
      console.log(`[Plus Launcher] Laravel encerrado com código ${code}`);
      laravelProcess = null;
    });

    setTimeout(() => {
      if (!started) {
        console.log("[Plus Launcher] Timeout aguardando Laravel iniciar");
        resolve(false);
      }
    }, 15000);
  });
}

export function stopLaravelServer(): void {
  if (laravelProcess && !laravelProcess.killed) {
    console.log("[Plus Launcher] Encerrando Laravel...");
    laravelProcess.kill("SIGTERM");
    laravelProcess = null;
  }
}

export function isLaravelRunning(): boolean {
  return laravelProcess !== null && !laravelProcess.killed;
}

process.on("SIGINT", () => {
  stopLaravelServer();
  process.exit(0);
});

process.on("SIGTERM", () => {
  stopLaravelServer();
  process.exit(0);
});
