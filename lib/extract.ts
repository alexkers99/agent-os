// Text/archive extraction using only Node built-ins (zlib). No external packages.
// Used by the vault upload route to handle .zip / .docx / .pdf without adding deps.
import zlib from "zlib";

export interface ZipEntry {
  name: string;
  data: Buffer;
}

const EOCD_SIG = 0x06054b50; // End Of Central Directory
const CDH_SIG = 0x02014b50; // Central Directory Header

// Minimal ZIP reader: parse the central directory, inflate each entry.
// ponytail: no ZIP64 / encryption / bzip2 — fine for normal .zip/.docx; widen if a real file needs it.
export function unzip(buf: Buffer): ZipEntry[] {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not a valid zip archive");

  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];

  for (let n = 0; n < count && off + 46 <= buf.length; n++) {
    if (buf.readUInt32LE(off) !== CDH_SIG) break;
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.toString("utf8", off + 46, off + 46 + nameLen);
    off += 46 + nameLen + extraLen + commentLen;

    if (name.endsWith("/")) continue; // directory entry
    const lhNameLen = buf.readUInt16LE(localOff + 26);
    const lhExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lhNameLen + lhExtraLen;
    const comp = buf.subarray(dataStart, dataStart + compSize);

    let data: Buffer;
    if (method === 0) data = Buffer.from(comp); // stored
    else if (method === 8) {
      try {
        data = zlib.inflateRawSync(comp);
      } catch {
        continue; // corrupt entry — skip rather than fail the whole upload
      }
    } else continue; // unsupported compression
    entries.push({ name, data });
  }
  return entries;
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// .docx is a zip; the body text lives in word/document.xml as <w:t> runs.
export function docxToText(buf: Buffer): string {
  const doc = unzip(buf).find((e) => e.name === "word/document.xml");
  if (!doc) return "";
  const xml = doc.data.toString("utf8");
  return decodeXmlEntities(
    xml
      .replace(/<w:tab\b[^>]*\/>/g, "\t")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<w:br\b[^>]*\/>/g, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodePdfString(s: string): string {
  const map: Record<string, string> = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", "(": "(", ")": ")", "\\": "\\" };
  return s
    .replace(/\\([nrtbf()\\])/g, (_, c: string) => map[c] ?? c)
    .replace(/\\([0-7]{1,3})/g, (_, o: string) => String.fromCharCode(parseInt(o, 8)));
}

// Pull text-showing operands out of a decoded content stream. Positioning operators
// (Td/TD/T*) become newlines so the output keeps rough line structure.
function extractPdfText(content: string): string {
  const re = /\((?:\\[\s\S]|[^()\\])*\)|\b(?:Td|TD|T\*)\b/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    if (m[0].startsWith("(")) out.push(decodePdfString(m[0].slice(1, -1)));
    else out.push("\n");
  }
  return out.join("");
}

// Best-effort PDF text extraction with built-ins only.
// ponytail: handles uncompressed + FlateDecode text streams; will miss scanned/image PDFs,
//   object-stream xrefs, and custom CID font encodings. Upgrade path = a real pdf lib if needed.
export function pdfToText(buf: Buffer): string {
  const raw = buf.toString("latin1");
  const streamRe = /(?:^|[^A-Za-z])stream\r?\n([\s\S]*?)endstream/g;
  const chunks: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = streamRe.exec(raw))) {
    const bytes = Buffer.from(m[1], "latin1");
    let text: string;
    try {
      text = zlib.inflateSync(bytes).toString("latin1");
    } catch {
      try {
        text = zlib.inflateRawSync(bytes).toString("latin1");
      } catch {
        text = m[1]; // uncompressed content stream
      }
    }
    const t = extractPdfText(text).trim();
    if (t) chunks.push(t);
  }
  return chunks.join("\n").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
