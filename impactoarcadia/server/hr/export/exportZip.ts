// Sprint RH-4 — empacota os arquivos em um ZIP em memória usando archiver.
import * as archiver from "archiver";

export async function buildExportZip(files: Record<string, Buffer>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = (archiver as any).default
      ? (archiver as any).default("zip", { zlib: { level: 9 } })
      : (archiver as any)("zip", { zlib: { level: 9 } });
    const chunks: Buffer[] = [];
    archive.on("data", (c: Buffer) => chunks.push(c));
    archive.on("warning", (err: any) => {
      if (err.code !== "ENOENT") reject(err);
    });
    archive.on("error", reject);
    archive.on("end", () => resolve(Buffer.concat(chunks)));

    for (const [name, buf] of Object.entries(files)) {
      archive.append(buf, { name });
    }
    archive.finalize().catch(reject);
  });
}
