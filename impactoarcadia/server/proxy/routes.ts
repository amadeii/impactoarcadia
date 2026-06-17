import { Router, Request, Response } from "express";
import { CookieJar, Cookie } from "tough-cookie";
import * as cheerio from "cheerio";
import https from "https";
import http from "http";
import { URL } from "url";

const router = Router();

const userCookieJars = new Map<string, CookieJar>();

const ALLOWED_DOMAINS = [
  "econeteditora.com.br",
  "www.econeteditora.com.br",
  "drive.google.com",
  "docs.google.com",
  "bcprime.com.br",
  "www.bcprime.com.br",
  "bcprime.app.br",
  "bcs.bcprime.app.br",
  "arcadiabusiness.com.br",
  "www.arcadiabusiness.com.br",
  "vendaerp.com.br",
  "novaapi.vendaerp.com.br",
];

function isDomainAllowed(hostname: string): boolean {
  return ALLOWED_DOMAINS.some(
    (d) => hostname === d || hostname.endsWith("." + d)
  );
}

function getCookieJar(userId: string): CookieJar {
  if (!userCookieJars.has(userId)) {
    userCookieJars.set(userId, new CookieJar());
  }
  return userCookieJars.get(userId)!;
}

function rewriteHtml(
  html: string,
  baseUrl: URL,
  proxyBase: string
): string {
  const $ = cheerio.load(html);

  const rewriteUrl = (attr: string, el: any) => {
    const val = $(el).attr(attr);
    if (!val) return;
    if (val.startsWith("data:") || val.startsWith("javascript:") || val.startsWith("#")) return;

    try {
      const absolute = new URL(val, baseUrl.href);
      if (isDomainAllowed(absolute.hostname)) {
        const proxied = `${proxyBase}?url=${encodeURIComponent(absolute.href)}`;
        $(el).attr(attr, proxied);
      }
    } catch {}
  };

  $("a[href]").each((_, el) => rewriteUrl("href", el));
  $("form[action]").each((_, el) => rewriteUrl("action", el));
  $("img[src]").each((_, el) => rewriteUrl("src", el));
  $("script[src]").each((_, el) => rewriteUrl("src", el));
  $("link[href]").each((_, el) => rewriteUrl("href", el));
  $("iframe[src]").each((_, el) => rewriteUrl("src", el));

  $("head").prepend(`
    <script>
      (function() {
        var __PROXY_TARGET_ORIGIN__ = '${baseUrl.origin}';
        var __PROXY_BASE__ = '${proxyBase}';
        
        function resolveAndProxy(url) {
          if (!url || url.startsWith('data:') || url.startsWith('javascript:') || url.startsWith('#')) {
            return url;
          }
          if (url.startsWith(__PROXY_BASE__)) {
            return url;
          }
          try {
            var absolute = new URL(url, __PROXY_TARGET_ORIGIN__);
            return __PROXY_BASE__ + '?url=' + encodeURIComponent(absolute.href);
          } catch(e) {
            return url;
          }
        }

        var origOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
          return origOpen.call(this, method, resolveAndProxy(url), async !== false, user, password);
        };

        var origFetch = window.fetch;
        window.fetch = function(input, init) {
          if (typeof input === 'string') {
            input = resolveAndProxy(input);
          } else if (input instanceof Request) {
            input = new Request(resolveAndProxy(input.url), input);
          }
          return origFetch.call(this, input, init);
        };
      })();
    </script>
  `);

  return $.html();
}

function rewriteCss(css: string, baseUrl: URL, proxyBase: string): string {
  return css.replace(/url\(['"]?([^'")\s]+)['"]?\)/gi, (match, urlValue) => {
    if (urlValue.startsWith("data:")) return match;
    try {
      const absolute = new URL(urlValue, baseUrl.href);
      if (isDomainAllowed(absolute.hostname)) {
        return `url('${proxyBase}?url=${encodeURIComponent(absolute.href)}')`;
      }
    } catch {}
    return match;
  });
}

router.all("/frame", async (req: Request, res: Response) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      return res.status(400).json({ error: "Missing url parameter" });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return res.status(400).json({ error: "Invalid URL" });
    }

    if (!isDomainAllowed(parsedUrl.hostname)) {
      return res.status(403).json({ 
        error: "Domain not allowed",
        domain: parsedUrl.hostname,
        allowed: ALLOWED_DOMAINS
      });
    }

    const userId = req.user.id;
    const cookieJar = getCookieJar(userId);
    const proxyBase = "/api/proxy/frame";

    const cookies = await cookieJar.getCookies(targetUrl);
    const cookieHeader = cookies.map((c) => c.cookieString()).join("; ");

    const proxyHeaders: Record<string, string | string[] | undefined> = {
      "user-agent": req.headers["user-agent"],
      "accept": req.headers["accept"] || "*/*",
      "accept-language": req.headers["accept-language"],
      "host": parsedUrl.hostname,
      "origin": parsedUrl.origin,
      "referer": targetUrl,
      "accept-encoding": "identity",
    };
    
    if (cookieHeader) {
      proxyHeaders["cookie"] = cookieHeader;
    }

    const requestOptions: https.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: req.method,
      headers: proxyHeaders,
    };

    const protocol = parsedUrl.protocol === "https:" ? https : http;

    const proxyReq = protocol.request(requestOptions, async (proxyRes) => {
      const setCookieHeaders = proxyRes.headers["set-cookie"];
      if (setCookieHeaders) {
        for (const cookieStr of setCookieHeaders) {
          try {
            const cookie = Cookie.parse(cookieStr);
            if (cookie) {
              await cookieJar.setCookie(cookie, targetUrl);
            }
          } catch {}
        }
      }

      const contentType = proxyRes.headers["content-type"] || "";
      const chunks: Buffer[] = [];

      proxyRes.on("data", (chunk) => chunks.push(chunk));
      proxyRes.on("end", () => {
        const body = Buffer.concat(chunks);

        const responseHeaders: Record<string, string | string[]> = {};
        for (const [key, value] of Object.entries(proxyRes.headers)) {
          if (
            key.toLowerCase() !== "set-cookie" &&
            key.toLowerCase() !== "x-frame-options" &&
            key.toLowerCase() !== "content-security-policy" &&
            key.toLowerCase() !== "content-length" &&
            key.toLowerCase() !== "transfer-encoding" &&
            value
          ) {
            responseHeaders[key] = value as string | string[];
          }
        }

        res.set(responseHeaders);
        res.status(proxyRes.statusCode || 200);

        if (contentType.includes("text/html")) {
          const html = body.toString("utf-8");
          const rewritten = rewriteHtml(html, parsedUrl, proxyBase);
          res.send(rewritten);
        } else if (contentType.includes("text/css")) {
          const css = body.toString("utf-8");
          const rewritten = rewriteCss(css, parsedUrl, proxyBase);
          res.type("text/css").send(rewritten);
        } else {
          res.send(body);
        }
      });
    });

    proxyReq.on("error", (err) => {
      console.error("[Proxy] Request error:", err.message);
      res.status(502).json({ error: "Proxy request failed", message: err.message });
    });

    if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
      const contentTypeHeader = req.headers["content-type"] || "";
      
      if (req.body) {
        let bodyData: string | Buffer;
        
        if (Buffer.isBuffer(req.body)) {
          bodyData = req.body;
        } else if (typeof req.body === "string") {
          bodyData = req.body;
        } else if (contentTypeHeader.includes("application/json")) {
          bodyData = JSON.stringify(req.body);
          proxyReq.setHeader("content-type", "application/json");
        } else if (contentTypeHeader.includes("application/x-www-form-urlencoded")) {
          bodyData = new URLSearchParams(req.body as Record<string, string>).toString();
          proxyReq.setHeader("content-type", "application/x-www-form-urlencoded");
        } else {
          bodyData = new URLSearchParams(req.body as Record<string, string>).toString();
          proxyReq.setHeader("content-type", "application/x-www-form-urlencoded");
        }
        
        proxyReq.setHeader("content-length", Buffer.byteLength(bodyData));
        proxyReq.write(bodyData);
      }
    }

    proxyReq.end();
  } catch (error: any) {
    console.error("[Proxy] Error:", error);
    res.status(500).json({ error: "Proxy error", message: error.message });
  }
});

router.post("/clear-session", (req: Request, res: Response) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const userId = req.user.id;
  userCookieJars.delete(userId);
  res.json({ success: true, message: "Session cleared" });
});

router.get("/allowed-domains", (_req: Request, res: Response) => {
  res.json({ domains: ALLOWED_DOMAINS });
});

export default router;
