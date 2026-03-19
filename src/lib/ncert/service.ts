import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import sanitizeFilename from "sanitize-filename";

import { NcertServiceError, toNcertServiceError } from "@/lib/ncert/errors";
import { getNcertCatalogBook } from "@/lib/ncert/catalog";
import {
  getNcertSourceClient,
  getZipUrl,
  inferContentType,
  type NcertAssetPayload,
} from "@/lib/ncert/source";
import type { NcertBookManifest, NcertCatalogBook, NcertManifestSection } from "@/lib/ncert/types";

const CACHE_DIR = path.join(process.cwd(), ".ncert-cache");

const archiveCache = new Map<string, Promise<JSZip>>();
const manifestCache = new Map<string, Promise<NcertBookManifest>>();
const compiledBookCache = new Map<string, Promise<Buffer>>();
const coverCache = new Map<string, Promise<NcertAssetPayload | undefined>>();

const SECTION_LABELS: Record<string, string> = {
  a1: "Answers I",
  a2: "Answers II",
  an: "Answers",
  ax: "Annexure",
  bt: "Brain Teasers",
  cc: "Cover",
  er: "Errata",
  ex: "Exercises",
  gl: "Glossary",
  gs: "Glossary",
  in: "Index",
  ix: "Appendix",
  lp: "Lekhak Parichay",
  mg: "Magazine",
  pp: "Practice Pages",
  pr: "Appendix",
  ps: "Prelims",
  qa: "Question Answers",
  rf: "References",
  sk: "Sabdkosh",
  sm: "Study Material",
  tn: "Teacher Notes",
  wc: "Worksheet",
};

function getBookOrThrow(bookId: string): NcertCatalogBook {
  const book = getNcertCatalogBook(bookId);
  if (!book) {
    throw new NcertServiceError(`Unknown NCERT book id: ${bookId}`, 404);
  }

  return book;
}

export function resetNcertServiceCaches() {
  archiveCache.clear();
  manifestCache.clear();
  compiledBookCache.clear();
  coverCache.clear();
}

function getCompiledBookPath(book: NcertCatalogBook): string {
  return path.join(CACHE_DIR, "books", `${book.id}.pdf`);
}

function getBookFilename(book: NcertCatalogBook, withClassPrefix = false): string {
  const baseName = withClassPrefix ? `${book.classLabel} - ${book.title}` : book.title;
  return `${sanitizeFilename(baseName) || book.id}.pdf`;
}

async function ensureCacheDir(subdirectory: string): Promise<void> {
  await mkdir(path.join(CACHE_DIR, subdirectory), { recursive: true });
}

function getEntrySuffix(book: NcertCatalogBook, entryName: string): string {
  const basename = path.posix.basename(entryName, path.posix.extname(entryName));
  return basename.startsWith(book.routeKey)
    ? basename.slice(book.routeKey.length).toLowerCase()
    : basename.toLowerCase();
}

function getSectionKind(book: NcertCatalogBook, entryName: string): NcertManifestSection["kind"] {
  const suffix = getEntrySuffix(book, entryName);

  if (suffix === "cc") {
    return "cover";
  }

  if (/^\d{2}$/.test(suffix) || suffix === "ps") {
    return "content";
  }

  return "supplement";
}

function getSectionLabel(book: NcertCatalogBook, entryName: string): string {
  const suffix = getEntrySuffix(book, entryName);

  if (/^\d{2}$/.test(suffix)) {
    return `Chapter ${Number(suffix)}`;
  }

  return SECTION_LABELS[suffix] ?? `Section ${suffix.toUpperCase()}`;
}

async function getBookArchive(bookId: string): Promise<JSZip> {
  const cached = archiveCache.get(bookId);
  if (cached) {
    return cached;
  }

  const book = getBookOrThrow(bookId);
  const archivePromise = getNcertSourceClient()
    .getArchive(book)
    .then((archivePayload) => JSZip.loadAsync(archivePayload.bytes))
    .catch((error) => {
      archiveCache.delete(bookId);
      throw toNcertServiceError(error);
    });

  archiveCache.set(bookId, archivePromise);
  return archivePromise;
}

async function getCoverAsset(bookId: string): Promise<NcertAssetPayload | undefined> {
  const cached = coverCache.get(bookId);
  if (cached) {
    return cached;
  }

  const book = getBookOrThrow(bookId);
  const coverPromise = getNcertSourceClient()
    .getCoverAsset(book)
    .catch((error) => {
      coverCache.delete(bookId);
      throw toNcertServiceError(error);
    });

  coverCache.set(bookId, coverPromise);
  return coverPromise;
}

export async function getImageCoverAsset(bookId: string): Promise<NcertAssetPayload> {
  const cover = await getCoverAsset(bookId);

  if (!cover || !cover.contentType.startsWith("image/")) {
    throw new NcertServiceError(`No image cover available for ${bookId}`, 404);
  }

  return cover;
}

async function loadSectionAsset(
  bookId: string,
  section: NcertManifestSection,
): Promise<NcertAssetPayload> {
  if (section.sourceType === "asset") {
    const cover = await getCoverAsset(bookId);
    if (!cover || cover.url !== section.href) {
      throw new NcertServiceError(`Cover asset not available for ${bookId}`, 502);
    }
    return cover;
  }

  const archive = await getBookArchive(bookId);
  const file = archive.file(section.href);
  if (!file) {
    throw new NcertServiceError(`Missing archive entry ${section.href} for ${bookId}`, 404);
  }

  return {
    bytes: await file.async("uint8array"),
    contentType: inferContentType(section.href),
    url: `${getZipUrl(getBookOrThrow(bookId))}#${section.href}`,
  };
}

async function buildBookManifest(bookId: string): Promise<NcertBookManifest> {
  const book = getBookOrThrow(bookId);
  const archive = await getBookArchive(bookId);
  const archiveEntries = Object.values(archive.files).filter((entry) => !entry.dir);
  const archiveHasCover = archiveEntries.some((entry) => getEntrySuffix(book, entry.name) === "cc");
  const cover = archiveHasCover ? undefined : await getCoverAsset(bookId);
  const warnings: string[] = [];
  const sections: NcertManifestSection[] = [];
  const coverSource: NcertBookManifest["sourceSummary"]["coverSource"] = archiveHasCover
    ? "zip-entry"
    : cover
      ? "external-asset"
      : "none";

  if (cover) {
    sections.push({
      id: "00-cover",
      label: "Cover",
      href: cover.url,
      sourceType: "asset",
      includeInFullBook: true,
      kind: "cover",
    });
  }

  sections.push(
    ...archiveEntries.map((entry, index) => {
      const suffix = getEntrySuffix(book, entry.name);
      if (!SECTION_LABELS[suffix] && !/^\d{2}$/.test(suffix) && suffix !== "cc") {
        warnings.push(`Unmapped section suffix ${suffix.toUpperCase()} was included as a supplement.`);
      }

      return {
        id: `${String(index + 1).padStart(2, "0")}-${suffix}`,
        label: getSectionLabel(book, entry.name),
        href: entry.name,
        sourceType: "zip-entry" as const,
        includeInFullBook: true,
        kind: getSectionKind(book, entry.name),
      };
    }),
  );

  if (coverSource === "none") {
    warnings.push("This book does not expose a separate cover asset, so preview starts with the first archive section.");
  }

  return {
    book,
    previewHref: cover?.url,
    zipHref: getZipUrl(book),
    sections,
    assemblyNotes: [
      "Compiled PDFs are merged from the official NCERT complete-book zip in archive order.",
      "When NCERT exposes a standalone cover outside the zip, it is prepended to the merged PDF.",
      "QR-code instructions and rationalised-content notices are not part of the official complete-book archive, so they are intentionally excluded here.",
    ],
    warnings,
    sourceSummary: {
      zipHref: getZipUrl(book),
      coverSource,
      sectionCount: sections.length,
    },
  };
}

export function getBookManifest(bookId: string): Promise<NcertBookManifest> {
  const cached = manifestCache.get(bookId);
  if (cached) {
    return cached;
  }

  const manifestPromise = buildBookManifest(bookId).catch((error) => {
    manifestCache.delete(bookId);
    throw toNcertServiceError(error);
  });

  manifestCache.set(bookId, manifestPromise);
  return manifestPromise;
}

async function appendAsset(mergedPdf: PDFDocument, asset: NcertAssetPayload): Promise<void> {
  if (asset.contentType === "application/pdf") {
    const sourcePdf = await PDFDocument.load(asset.bytes);
    const copiedPages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
    for (const page of copiedPages) {
      mergedPdf.addPage(page);
    }
    return;
  }

  if (asset.contentType === "image/png") {
    const image = await mergedPdf.embedPng(asset.bytes);
    const page = mergedPdf.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    return;
  }

  if (asset.contentType === "image/jpeg") {
    const image = await mergedPdf.embedJpg(asset.bytes);
    const page = mergedPdf.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    return;
  }

  throw new NcertServiceError(`Unsupported NCERT asset type: ${asset.contentType}`, 500);
}

async function buildCompiledBook(bookId: string): Promise<Buffer> {
  const manifest = await getBookManifest(bookId);
  await ensureCacheDir("books");
  const cachePath = getCompiledBookPath(manifest.book);

  try {
    await stat(cachePath);
    return await readFile(cachePath);
  } catch {
    // Cache miss.
  }

  try {
    const mergedPdf = await PDFDocument.create();

    for (const section of manifest.sections) {
      if (!section.includeInFullBook) {
        continue;
      }

      const asset = await loadSectionAsset(bookId, section);
      await appendAsset(mergedPdf, asset);
    }

    const bytes = Buffer.from(await mergedPdf.save());
    await writeFile(cachePath, bytes);
    return bytes;
  } catch (error) {
    throw new NcertServiceError(`Could not compile ${manifest.book.title}.`, 500, { cause: error });
  }
}

export function getCompiledBook(bookId: string): Promise<Buffer> {
  const cached = compiledBookCache.get(bookId);
  if (cached) {
    return cached;
  }

  const compiledPromise = buildCompiledBook(bookId).catch((error) => {
    compiledBookCache.delete(bookId);
    throw toNcertServiceError(error);
  });
  compiledBookCache.set(bookId, compiledPromise);
  return compiledPromise;
}

export async function getPreviewAsset(bookId: string): Promise<NcertAssetPayload> {
  const manifest = await getBookManifest(bookId);
  for (const section of manifest.sections) {
    try {
      return await loadSectionAsset(bookId, section);
    } catch {
      // Try the next section if the preferred preview asset is temporarily unavailable.
    }
  }

  throw new NcertServiceError(`No preview section found for ${bookId}`, 404);
}

export async function getSectionAsset(
  bookId: string,
  sectionId: string,
): Promise<NcertAssetPayload> {
  const manifest = await getBookManifest(bookId);
  const section = manifest.sections.find((entry) => entry.id === sectionId);

  if (!section) {
    throw new NcertServiceError(`Section ${sectionId} not found for ${bookId}`, 404);
  }

  return loadSectionAsset(bookId, section);
}

export function getDownloadFilename(bookId: string): string {
  const book = getNcertCatalogBook(bookId);
  if (!book) {
    return `${bookId}.pdf`;
  }

  return getBookFilename(book);
}

export async function buildBulkZip(bookIds: string[]): Promise<Buffer> {
  const books = bookIds
    .map((bookId) => getNcertCatalogBook(bookId))
    .filter((book): book is NcertCatalogBook => Boolean(book));

  if (books.length === 0) {
    throw new NcertServiceError("No valid books were selected for export.", 404);
  }

  const duplicateTitleCount = new Map<string, number>();
  for (const book of books) {
    duplicateTitleCount.set(book.title, (duplicateTitleCount.get(book.title) ?? 0) + 1);
  }

  const zip = new JSZip();
  for (const book of books) {
    const compiledBook = await getCompiledBook(book.id);
    zip.file(
      getBookFilename(book, (duplicateTitleCount.get(book.title) ?? 0) > 1),
      compiledBook,
    );
  }

  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}
