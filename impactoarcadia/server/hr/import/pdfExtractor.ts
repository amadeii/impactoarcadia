// Sprint RH-3 — extração de texto de PDF do Domínio.
// Usa pdfjs-dist legacy/mjs (compatível com Node sem canvas).

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Worker desabilitado em Node — pdfjs roda no main thread.
  if (pdfjs.GlobalWorkerOptions) pdfjs.GlobalWorkerOptions.workerSrc = "";
  const data = new Uint8Array(buffer);
  const doc = await pdfjs.getDocument({ data, disableWorker: true, isEvalSupported: false }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // Mantém quebras de coluna usando o Y das marcas (heurística simples).
    const items = content.items as any[];
    let lastY: number | null = null;
    let line: string[] = [];
    const lines: string[] = [];
    for (const it of items) {
      const y = Math.round((it.transform?.[5] ?? 0) * 10) / 10;
      if (lastY !== null && Math.abs(y - lastY) > 1.5) {
        if (line.length) lines.push(line.join(" "));
        line = [];
      }
      lastY = y;
      if (it.str) line.push(it.str);
    }
    if (line.length) lines.push(line.join(" "));
    pages.push(lines.join("\n"));
  }
  return pages.join("\n--- PÁGINA ---\n");
}
