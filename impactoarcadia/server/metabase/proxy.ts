import { Express, Response } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";

const METABASE_HOST = process.env.METABASE_HOST || "localhost";
const METABASE_PORT = parseInt(process.env.METABASE_PORT || "8088", 10);
const METABASE_TIMEOUT = 60000;

export function setupMetabaseProxy(app: Express): void {
  const metabaseTarget = `http://${METABASE_HOST}:${METABASE_PORT}`;

  const metabaseProxy = createProxyMiddleware({
    target: metabaseTarget,
    changeOrigin: true,
    timeout: METABASE_TIMEOUT,
    proxyTimeout: METABASE_TIMEOUT,
    pathRewrite: {
      "^/metabase": "",
    },
    on: {
      error: (err, _req, res) => {
        console.error("[Metabase Proxy] Error:", err.message);
        if (res && typeof (res as Response).status === "function") {
          (res as Response).status(502).json({
            error: "Metabase indisponível",
            message: "O Metabase está iniciando ou não está acessível. Tente novamente em alguns segundos.",
            target: metabaseTarget,
          });
        }
      },
      proxyRes: (proxyRes, _req, _res) => {
        const location = proxyRes.headers["location"];
        if (location && typeof location === "string" && location.startsWith("/")) {
          proxyRes.headers["location"] = `/metabase${location}`;
        }
      },
    },
  });

  app.use("/metabase", metabaseProxy);

  console.log(`[Metabase Proxy] Configurado -> /metabase/* => ${metabaseTarget}`);
}
