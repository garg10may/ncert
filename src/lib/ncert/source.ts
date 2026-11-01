import http from "node:http";
import https from "node:https";
import tls from "node:tls";
import { Buffer } from "node:buffer";

import JSZip from "jszip";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { NcertServiceError } from "@/lib/ncert/errors";
import type { NcertCatalogBook } from "@/lib/ncert/types";

const NCERT_BASE_URL = "https://ncert.nic.in";
const NCERT_HEADERS = {
  "accept-language": "en-US,en;q=0.9",
  "user-agent": "Mozilla/5.0 (compatible; NCERT Atlas/1.0; +https://ncert.nic.in)",
};

// NCERT currently serves its leaf certificate without the Let's Encrypt YE1
// intermediate. Keep verification enabled and supply the certificates published
// at https://letsencrypt.org/certs/gen-y/int-ye1.pem and
// https://letsencrypt.org/certs/gen-y/root-ye-by-x2.pem.
const NCERT_ISSUER_CERTIFICATE = `-----BEGIN CERTIFICATE-----
MIICizCCAhGgAwIBAgIQXd1w3TH4AchcGGp6BLgK/jAKBggqhkjOPQQDAzAuMQsw
CQYDVQQGEwJVUzENMAsGA1UEChMESVNSRzEQMA4GA1UEAxMHUm9vdCBZRTAeFw0y
NTA5MDMwMDAwMDBaFw0yODA5MDIyMzU5NTlaMDMxCzAJBgNVBAYTAlVTMRYwFAYD
VQQKEw1MZXQncyBFbmNyeXB0MQwwCgYDVQQDEwNZRTEwdjAQBgcqhkjOPQIBBgUr
gQQAIgNiAAQHZVB1/mimla2hfSurylScjPMZaOJXLz/NnAc2sylm8WDyhU9Ccp+z
ASQi5vSwGGJjSGklkD9fdPR8GpyDIOIjCEfrnbt/v+ZSEPLLEGbaM6EccDbN7p9x
teIm2Avf+ryjge4wgeswDgYDVR0PAQH/BAQDAgGGMBMGA1UdJQQMMAoGCCsGAQUF
BwMBMBIGA1UdEwEB/wQIMAYBAf8CAQAwHQYDVR0OBBYEFLsgykcL/tflnPmPCSqj
jDdFsbzYMB8GA1UdIwQYMBaAFKPIJlqOoUzQNWP8myPIOq5W809WMDIGCCsGAQUF
BwEBBCYwJDAiBggrBgEFBQcwAoYWaHR0cDovL3llLmkubGVuY3Iub3JnLzATBgNV
HSAEDDAKMAgGBmeBDAECATAnBgNVHR8EIDAeMBygGqAYhhZodHRwOi8veWUuYy5s
ZW5jci5vcmcvMAoGCCqGSM49BAMDA2gAMGUCMQDgjUEahFT/h3DRakqiPZpLvPgf
Zwkt6K2EOMmh1nvEzl83eMLYcod4GCl3b0J1Nn0CMBNYmEQJb4CEG5WoOe7aRn/L
VKu6saHmHEynI7ysIPd8zQsK1HdmhlHKlw9Z5GpGvA==
-----END CERTIFICATE-----`;

const NCERT_CROSS_SIGNED_ROOT_CERTIFICATE = `-----BEGIN CERTIFICATE-----
MIICpjCCAiugAwIBAgIRAIchZfw0tuX7qK3Vs3BftTowCgYIKoZIzj0EAwMwTzEL
MAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2VhcmNo
IEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDIwHhcNMjYwNTEzMDAwMDAwWhcN
MzIwOTAyMjM1OTU5WjAuMQswCQYDVQQGEwJVUzENMAsGA1UEChMESVNSRzEQMA4G
A1UEAxMHUm9vdCBZRTB2MBAGByqGSM49AgEGBSuBBAAiA2IABDwS/6vhrcVqcbBo
+wgdI3fwn9x7DNJJOY/lTOti0vkwuRN87RhEhTH17E7XyFjWsPYhIPt/wzOqxTd2
b+4ZJNy9ID04YywF9U5zasDVyGSNErVNtz8uSGh5izW87j77GaOB6zCB6DAOBgNV
HQ8BAf8EBAMCAQYwEwYDVR0lBAwwCgYIKwYBBQUHAwEwDwYDVR0TAQH/BAUwAwEB
/zAdBgNVHQ4EFgQUo8gmWo6hTNA1Y/ybI8g6rlbzT1YwHwYDVR0jBBgwFoAUfEKW
rt5LSDv6kviejM9ti6lyN5UwMgYIKwYBBQUHAQEEJjAkMCIGCCsGAQUFBzAChhZo
dHRwOi8veDIuaS5sZW5jci5vcmcvMBMGA1UdIAQMMAowCAYGZ4EMAQIBMCcGA1Ud
HwQgMB4wHKAaoBiGFmh0dHA6Ly94Mi5jLmxlbmNyLm9yZy8wCgYIKoZIzj0EAwMD
aQAwZgIxAMU19WCtmxVND8UHBZRoma49Z7jPs64Dma0eTu1OChVbB/2J7GV3nvYK
Ax54uk1G9QIxAO0miLVJu8PLNiXXXkiE/gsK3CTRTF/aeo4bMX42Zw40csRU6AC2
6hSW1/IWaas6dg==
-----END CERTIFICATE-----`;

const NCERT_CA_CERTIFICATES = [
  ...tls.rootCertificates,
  NCERT_ISSUER_CERTIFICATE,
  NCERT_CROSS_SIGNED_ROOT_CERTIFICATE,
];

const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9s4f7WQAAAAASUVORK5CYII=";

export type NcertAssetPayload = {
  bytes: Uint8Array;
  contentType: string;
  url: string;
};

export type NcertArchivePayload = {
  bytes: Buffer;
  url: string;
};

export type NcertSourceClient = {
  mode: "fixture" | "live";
  getArchive(book: NcertCatalogBook): Promise<NcertArchivePayload>;
  getCoverAsset(book: NcertCatalogBook): Promise<NcertAssetPayload | undefined>;
};

type FixtureDefinition = {
  cover?: { bytes: Uint8Array; contentType: string; extension: "png" | "jpg" | "pdf" };
  entries: Array<{ name: string; bytes: Uint8Array }>;
};

const fixtureCache = new Map<string, Promise<FixtureDefinition>>();
let sourceClientOverride: NcertSourceClient | null = null;

export function getZipUrl(book: NcertCatalogBook): string {
  return `${NCERT_BASE_URL}/textbook/pdf/${book.routeKey}dd.zip`;
}

function getCoverCandidates(book: NcertCatalogBook): string[] {
  return [
    `${NCERT_BASE_URL}/textbook/pdf/${book.routeKey}cc.jpg`,
    `${NCERT_BASE_URL}/textbook/pdf/${book.routeKey}cc.pdf`,
    `${NCERT_BASE_URL}/textbook/pdf/${book.routeKey}cc.png`,
  ];
}

export function inferContentType(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (lower.endsWith(".png")) {
    return "image/png";
  }
  if (lower.endsWith(".zip")) {
    return "application/zip";
  }
  return "application/pdf";
}

function requestBuffer(url: string, redirects = 0, attempts = 0): Promise<Buffer> {
  if (redirects > 5) {
    return Promise.reject(new NcertServiceError(`Too many redirects while requesting ${url}`, 502));
  }

  const target = new URL(url);
  const client = target.protocol === "http:" ? http : https;

  return new Promise((resolve, reject) => {
    const request = client.request(
      {
        hostname: target.hostname,
        method: "GET",
        path: `${target.pathname}${target.search}`,
        port: target.port ? Number(target.port) : undefined,
        protocol: target.protocol,
        headers: NCERT_HEADERS,
        ...(target.hostname === "ncert.nic.in" ? { ca: NCERT_CA_CERTIFICATES } : {}),
      },
      (response) => {
        const statusCode = response.statusCode ?? 0;
        const location = response.headers.location;

        if (statusCode >= 300 && statusCode < 400 && location) {
          response.resume();
          resolve(requestBuffer(new URL(location, target).toString(), redirects + 1));
          return;
        }

        if (statusCode < 200 || statusCode >= 300) {
          const chunks: Buffer[] = [];
          response.on("data", (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });
          response.on("end", () => {
            reject(
              new NcertServiceError(
                `NCERT request failed for ${url}: ${statusCode} ${Buffer.concat(chunks).toString("utf8")}`,
                502,
              ),
            );
          });
          return;
        }

        const chunks: Buffer[] = [];
        response.on("data", (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on("end", () => resolve(Buffer.concat(chunks)));
      },
    );

    request.on("error", (error) => {
      if (
        attempts < 2 &&
        error instanceof Error &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === "ECONNRESET"
      ) {
        resolve(requestBuffer(url, redirects, attempts + 1));
        return;
      }

      reject(new NcertServiceError(`NCERT request failed for ${url}`, 502, { cause: error }));
    });
    request.end();
  });
}

async function createFixturePdf(title: string): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const page = document.addPage([595, 842]);
  const font = await document.embedFont(StandardFonts.HelveticaBold);

  page.drawRectangle({
    color: rgb(0.97, 0.94, 0.88),
    height: 842,
    width: 595,
    x: 0,
    y: 0,
  });
  page.drawText(title, {
    color: rgb(0.18, 0.16, 0.14),
    font,
    maxWidth: 460,
    size: 24,
    x: 56,
    y: 760,
  });
  page.drawText("Fixture NCERT content for automated verification.", {
    color: rgb(0.35, 0.31, 0.27),
    size: 14,
    x: 56,
    y: 726,
  });

  return document.save();
}

function createFixtureImage(): Uint8Array {
  return Uint8Array.from(Buffer.from(TINY_PNG_BASE64, "base64"));
}

async function buildFixtureDefinition(book: NcertCatalogBook): Promise<FixtureDefinition> {
  const defaultEntries = [
    { name: `${book.routeKey}ps.pdf`, bytes: await createFixturePdf(`${book.title} prelims`) },
    { name: `${book.routeKey}01.pdf`, bytes: await createFixturePdf(`${book.title} chapter 1`) },
    { name: `${book.routeKey}02.pdf`, bytes: await createFixturePdf(`${book.title} chapter 2`) },
  ];

  switch (book.id) {
    case "fepr1":
      return {
        cover: {
          bytes: createFixtureImage(),
          contentType: "image/png",
          extension: "png",
        },
        entries: [
          defaultEntries[0],
          defaultEntries[1],
          { name: `${book.routeKey}gl.pdf`, bytes: await createFixturePdf(`${book.title} glossary`) },
        ],
      };
    case "lefl1":
      return {
        entries: [
          { name: `${book.routeKey}cc.pdf`, bytes: await createFixturePdf(`${book.title} cover`) },
          defaultEntries[0],
          defaultEntries[1],
          defaultEntries[2],
        ],
      };
    case "kegy2":
      return {
        entries: [
          defaultEntries[1],
          defaultEntries[2],
          { name: `${book.routeKey}gl.pdf`, bytes: await createFixturePdf(`${book.title} glossary`) },
          { name: `${book.routeKey}a1.pdf`, bytes: await createFixturePdf(`${book.title} answers`) },
        ],
      };
    case "aemr1":
    case "bemr1":
      return {
        entries: [
          { name: `${book.routeKey}cc.pdf`, bytes: await createFixturePdf(book.title) },
          ...defaultEntries,
        ],
      };
    default:
      return {
        entries: defaultEntries,
      };
  }
}

async function getFixtureDefinition(book: NcertCatalogBook): Promise<FixtureDefinition> {
  const cached = fixtureCache.get(book.id);
  if (cached) {
    return cached;
  }

  const definitionPromise = buildFixtureDefinition(book);
  fixtureCache.set(book.id, definitionPromise);
  return definitionPromise;
}

const liveSourceClient: NcertSourceClient = {
  mode: "live",
  async getArchive(book) {
    return {
      bytes: await requestBuffer(getZipUrl(book)),
      url: getZipUrl(book),
    };
  },
  async getCoverAsset(book) {
    for (const candidate of getCoverCandidates(book)) {
      try {
        const bytes = await requestBuffer(candidate);
        return {
          bytes: new Uint8Array(bytes),
          contentType: inferContentType(candidate),
          url: candidate,
        };
      } catch {
        // Continue until a cover exists.
      }
    }

    return undefined;
  },
};

const fixtureSourceClient: NcertSourceClient = {
  mode: "fixture",
  async getArchive(book) {
    const definition = await getFixtureDefinition(book);
    const zip = new JSZip();

    for (const entry of definition.entries) {
      zip.file(entry.name, entry.bytes);
    }

    return {
      bytes: await zip.generateAsync({ type: "nodebuffer" }),
      url: getZipUrl(book),
    };
  },
  async getCoverAsset(book) {
    const definition = await getFixtureDefinition(book);
    if (!definition.cover) {
      return undefined;
    }

    return {
      bytes: definition.cover.bytes,
      contentType: definition.cover.contentType,
      url: `${NCERT_BASE_URL}/textbook/pdf/${book.routeKey}cc.${definition.cover.extension}`,
    };
  },
};

export function getNcertSourceClient(): NcertSourceClient {
  if (sourceClientOverride) {
    return sourceClientOverride;
  }

  return process.env.NCERT_SOURCE_MODE === "fixture" ? fixtureSourceClient : liveSourceClient;
}

export function setNcertSourceClientForTests(client: NcertSourceClient | null) {
  sourceClientOverride = client;
}
