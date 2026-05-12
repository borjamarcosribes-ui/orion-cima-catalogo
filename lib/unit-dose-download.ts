import { mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export type UnitDoseSourceMode = 'direct_xls_url' | 'page_discovery';

export type PreparedUnitDoseSource = {
  filePath: string;
  sourceMode: UnitDoseSourceMode;
  sourceUrl: string;
  downloadedBytes: number;
  cleanup: () => Promise<void>;
};

const HREF_PATTERN = /href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>"']+))/giu;

function getConfiguredTempRoot(): string {
  return process.env.SCMFH_UNIT_DOSE_TEMP_DIR?.trim() || path.join(os.tmpdir(), 'orion-cima-unit-dose');
}

function assertHttpUrl(rawUrl: string, context: string): URL {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`${context} no es una URL válida.`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`${context} debe usar http o https.`);
  }

  return parsed;
}

function isExcelUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl, 'https://example.invalid');
    return /\.xlsx?$/iu.test(parsed.pathname);
  } catch {
    return false;
  }
}

export function discoverExcelLinkFromHtml(html: string, pageUrl: string): string | null {
  const baseUrl = assertHttpUrl(pageUrl, 'SCMFH_UNIT_DOSE_PAGE_URL');
  HREF_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = HREF_PATTERN.exec(html)) !== null) {
    const href = (match[1] ?? match[2] ?? match[3])?.replace(/&amp;/giu, '&');
    if (!href || !isExcelUrl(href)) {
      continue;
    }

    try {
      const resolved = new URL(href, baseUrl);
      if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
        continue;
      }
      if (!isExcelUrl(resolved.toString())) {
        continue;
      }
      return resolved.toString();
    } catch {
      // Ignore malformed links and keep searching for the first reasonable Excel URL.
    }
  }

  return null;
}

async function downloadToBuffer(sourceUrl: string): Promise<Buffer> {
  const response = await fetch(sourceUrl, { redirect: 'follow' });

  if (!response.ok) {
    throw new Error(`No se pudo descargar ${sourceUrl}: HTTP ${response.status}.`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function discoverExcelUrlFromPage(pageUrl: string): Promise<string> {
  const response = await fetch(pageUrl, { redirect: 'follow' });

  if (!response.ok) {
    throw new Error(`No se pudo descargar la página SCMFH ${pageUrl}: HTTP ${response.status}.`);
  }

  const html = await response.text();
  const discoveredUrl = discoverExcelLinkFromHtml(html, pageUrl);
  if (!discoveredUrl) {
    throw new Error(`No se encontró ningún enlace .xls/.xlsx en la página SCMFH ${pageUrl}.`);
  }

  return discoveredUrl;
}

function getTempFileName(sourceUrl: string): string {
  const parsed = new URL(sourceUrl);
  const extension = path.extname(parsed.pathname).toLowerCase() || '.xlsx';
  return `scmfh-unit-dose-${Date.now()}${extension}`;
}

export async function prepareUnitDoseSource(): Promise<PreparedUnitDoseSource> {
  const directXlsUrl = process.env.SCMFH_UNIT_DOSE_XLS_URL?.trim();
  const pageUrl = process.env.SCMFH_UNIT_DOSE_PAGE_URL?.trim();

  let sourceMode: UnitDoseSourceMode;
  let sourceUrl: string;

  if (directXlsUrl) {
    sourceMode = 'direct_xls_url';
    sourceUrl = assertHttpUrl(directXlsUrl, 'SCMFH_UNIT_DOSE_XLS_URL').toString();
    if (!isExcelUrl(sourceUrl)) {
      throw new Error('SCMFH_UNIT_DOSE_XLS_URL debe apuntar a un fichero .xls o .xlsx.');
    }
  } else if (pageUrl) {
    sourceMode = 'page_discovery';
    const normalizedPageUrl = assertHttpUrl(pageUrl, 'SCMFH_UNIT_DOSE_PAGE_URL').toString();
    sourceUrl = await discoverExcelUrlFromPage(normalizedPageUrl);
  } else {
    throw new Error('Configura SCMFH_UNIT_DOSE_XLS_URL o SCMFH_UNIT_DOSE_PAGE_URL para refrescar la caché de unidosis SCMFH.');
  }

  const tempRoot = getConfiguredTempRoot();
  const tempDir = path.join(tempRoot, `run-${process.pid}-${Date.now()}`);
  await mkdir(tempDir, { recursive: true });
  const filePath = path.join(tempDir, getTempFileName(sourceUrl));
  const buffer = await downloadToBuffer(sourceUrl);
  await writeFile(filePath, buffer);

  return {
    filePath,
    sourceMode,
    sourceUrl,
    downloadedBytes: buffer.byteLength,
    cleanup: async () => {
      await rm(tempDir, { recursive: true, force: true });
    },
  };
}
