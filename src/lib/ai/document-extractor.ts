/**
 * ============================================================================
 * OAKHAVEN AI FASE 3 — EXTRACTOR DOCUMENTAL MODULAR, CHUNKING Y CACHÉ POR HASH
 * ============================================================================
 * - Soporta texto plano (.txt, .md, .csv, .json) y PDFs con texto embebido
 *   (incluyendo streams FlateDecode vía node:zlib, sin dependencias externas).
 * - Detecta explícitamente PDFs escaneados sin texto extraíble (nunca inventa).
 * - Declara honestamente que imágenes no tienen OCR automático activo.
 * - Mantiene caché determinista por content_hash para ahorrar cómputo/costo.
 * - Sanea todo contenido extraído contra prompt injection (datos no confiables).
 */

import zlib from "node:zlib";
import { extractAndSanitizeDocumentText } from "./building-resources-engine.ts";

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export interface DocumentChunk {
  chunkIndex: number;
  pageNumber: number;
  sectionLabel: string;
  text: string;
}

export interface DocumentExtractionOutput {
  status: "extracted" | "scanned_no_text" | "image_not_ocr" | "blocked_sensitive" | "unsupported";
  pages: ExtractedPage[];
  chunks: DocumentChunk[];
  fullSanitizedText: string;
  promptInjectionDetected: boolean;
  notice?: string;
  cached?: boolean;
}

const extractionCacheByHash = new Map<string, DocumentExtractionOutput>();

function decodePdfLiteralString(raw: string): string {
  return raw
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, " ")
    .replace(/\\t/g, " ")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\");
}

function extractTextOperatorsFromStream(streamText: string): string {
  const pieces: string[] = [];
  // Operador simple: (texto) Tj
  const tjRegex = /\(([^()]*|\\[()])*\)\s*Tj/g;
  let m: RegExpExecArray | null;
  while ((m = tjRegex.exec(streamText)) !== null) {
    const inner = m[0].replace(/\)\s*Tj$/, "").slice(1);
    const decoded = decodePdfLiteralString(inner).trim();
    if (decoded) pieces.push(decoded);
  }
  // Operador array: [(a) -20 (b)] TJ
  const tjArrRegex = /\[([^\]]+)\]\s*TJ/g;
  while ((m = tjArrRegex.exec(streamText)) !== null) {
    const inside = m[1];
    const strMatches = inside.match(/\((?:\\.|[^\\()])*\)/g) || [];
    const joined = strMatches
      .map((s) => decodePdfLiteralString(s.slice(1, -1)))
      .join("")
      .trim();
    if (joined) pieces.push(joined);
  }
  return pieces.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Extrae texto de un PDF compatible sin dependencias pesadas.
 * Agrupa por streams/páginas reales y detecta PDFs escaneados sin texto.
 */
export function extractTextFromPdfBuffer(bytes: Uint8Array): ExtractedPage[] {
  const latin1 = Buffer.from(bytes).toString("latin1");
  const pages: ExtractedPage[] = [];
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;

  let match: RegExpExecArray | null;
  let pageIdx = 1;

  while ((match = streamRegex.exec(latin1)) !== null && pages.length < 30) {
    const rawStream = match[1];
    let decodedStream = rawStream;

    // Intentar descomprimir FlateDecode si el stream está comprimido
    const rawBuf = Buffer.from(rawStream, "latin1");
    try {
      const inflated = zlib.inflateSync(rawBuf);
      decodedStream = inflated.toString("latin1");
    } catch {
      // No era FlateDecode o ya venía en texto plano
    }

    const extracted = extractTextOperatorsFromStream(decodedStream);
    if (extracted.length > 0) {
      pages.push({ pageNumber: pageIdx, text: extracted });
      pageIdx += 1;
    }
  }

  return pages;
}

export function chunkExtractedPages(
  pages: ExtractedPage[],
  maxCharsPerChunk = 1200,
  maxChunks = 4
): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  for (const page of pages) {
    if (chunks.length >= maxChunks) break;
    const clean = page.text.trim();
    if (!clean) continue;

    let offset = 0;
    let part = 1;
    while (offset < clean.length && chunks.length < maxChunks) {
      const slice = clean.slice(offset, offset + maxCharsPerChunk).trim();
      chunks.push({
        chunkIndex: chunks.length + 1,
        pageNumber: page.pageNumber,
        sectionLabel: `Página ${page.pageNumber}${part > 1 ? ` (parte ${part})` : ""}`,
        text: slice,
      });
      offset += maxCharsPerChunk;
      part += 1;
    }
  }
  return chunks;
}

export function extractCompatibleDocument(params: {
  mimeType: string;
  bytes?: Uint8Array;
  rawText?: string;
  contentHash?: string | null;
  isFinancialSensitive: boolean;
}): DocumentExtractionOutput {
  if (params.isFinancialSensitive) {
    return {
      status: "blocked_sensitive",
      pages: [],
      chunks: [],
      fullSanitizedText: "",
      promptInjectionDetected: false,
      notice: "Documento financiero sensible: excluido de la extracción automática de texto.",
    };
  }

  if (params.contentHash && extractionCacheByHash.has(params.contentHash)) {
    const cached = extractionCacheByHash.get(params.contentHash)!;
    return { ...cached, cached: true };
  }

  const mime = (params.mimeType || "").toLowerCase();

  // Imágenes: ser honestos (sin OCR automático implementado en Fase 3)
  if (mime.startsWith("image/")) {
    return {
      status: "image_not_ocr",
      pages: [],
      chunks: [],
      fullSanitizedText: "",
      promptInjectionDetected: false,
      notice:
        "Esta imagen fue registrada correctamente, pero el OCR automático de imágenes no está habilitado todavía. Puedo usar su título, proyecto asociado y notas escritas, pero no leer texto dentro de la foto.",
    };
  }

  let pages: ExtractedPage[] = [];

  if (mime === "application/pdf") {
    if (!params.bytes || params.bytes.byteLength === 0) {
      return {
        status: "scanned_no_text",
        pages: [],
        chunks: [],
        fullSanitizedText: "",
        promptInjectionDetected: false,
        notice: "No se recibieron bytes del PDF para extracción.",
      };
    }
    pages = extractTextFromPdfBuffer(params.bytes);
    const totalChars = pages.reduce((acc, p) => acc + p.text.trim().length, 0);
    if (totalChars < 15) {
      return {
        status: "scanned_no_text",
        pages: [],
        chunks: [],
        fullSanitizedText: "",
        promptInjectionDetected: false,
        notice:
          "Este PDF parece estar escaneado o contener solo imágenes sin capa de texto extraíble. No inventaré instrucciones ni citas; puedes pegar el texto en notas o subir un PDF con texto seleccionable.",
      };
    }
  } else if (
    ["text/plain", "text/markdown", "text/csv", "application/json"].includes(mime) ||
    params.rawText
  ) {
    const text =
      params.rawText !== undefined
        ? params.rawText
        : params.bytes
        ? new TextDecoder("utf-8", { fatal: false }).decode(params.bytes)
        : "";
    const trimmed = text.trim();
    if (trimmed) {
      pages = [{ pageNumber: 1, text: trimmed }];
    }
  } else {
    return {
      status: "unsupported",
      pages: [],
      chunks: [],
      fullSanitizedText: "",
      promptInjectionDetected: false,
      notice: `Formato "${mime || "desconocido"}" no soportado para extracción de texto.`,
    };
  }

  // Saneo contra prompt injection en cada página
  let anyInjection = false;
  const sanitizedPages: ExtractedPage[] = pages.map((p) => {
    const res = extractAndSanitizeDocumentText({
      rawText: p.text,
      isFinancialSensitive: false,
      maxChars: 2400,
    });
    if (res.promptInjectionDetected) anyInjection = true;
    return { pageNumber: p.pageNumber, text: res.sanitizedText || "" };
  });

  const chunks = chunkExtractedPages(sanitizedPages, 1200, 4);
  const fullSanitizedText = sanitizedPages
    .map((p) => `[Página ${p.pageNumber}] ${p.text}`)
    .join("\n\n")
    .slice(0, 4800);

  const output: DocumentExtractionOutput = {
    status: "extracted",
    pages: sanitizedPages,
    chunks,
    fullSanitizedText,
    promptInjectionDetected: anyInjection,
  };

  if (params.contentHash) {
    extractionCacheByHash.set(params.contentHash, output);
  }
  return output;
}

export function clearExtractionCacheForTests(): void {
  extractionCacheByHash.clear();
}
