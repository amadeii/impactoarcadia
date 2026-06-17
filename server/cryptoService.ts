// Serviço de criptografia simples para configurações de conectores.
// Em produção, use variável de ambiente CRYPTO_SECRET para a chave.
import crypto from "crypto";

const ALGO = "aes-256-cbc";
const SECRET = process.env.CRYPTO_SECRET ?? "arcadia-suite-default-secret-key-32b";

function getKey(): Buffer {
  return crypto.scryptSync(SECRET, "arcadia-salt", 32);
}

export function encryptConfig(data: Record<string, any>): string {
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
    const json = JSON.stringify(data);
    const encrypted = Buffer.concat([cipher.update(json, "utf8"), cipher.final()]);
    return iv.toString("hex") + ":" + encrypted.toString("hex");
  } catch {
    return Buffer.from(JSON.stringify(data)).toString("base64");
  }
}

export function decryptConfig(encrypted: string | null): Record<string, any> {
  if (!encrypted) return {};
  try {
    const [ivHex, encHex] = encrypted.split(":");
    if (!ivHex || !encHex) {
      // fallback base64
      return JSON.parse(Buffer.from(encrypted, "base64").toString("utf8"));
    }
    const iv = Buffer.from(ivHex, "hex");
    const enc = Buffer.from(encHex, "hex");
    const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
    const decrypted = Buffer.concat([decipher.update(enc), decipher.final()]);
    return JSON.parse(decrypted.toString("utf8"));
  } catch {
    return {};
  }
}
