import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

export const SCMFH_UNIT_DOSE_XLS_URL = process.env.SCMFH_UNIT_DOSE_XLS_URL?.trim() || '';
export const SCMFH_UNIT_DOSE_PAGE_URL =
  process.env.SCMFH_UNIT_DOSE_PAGE_URL?.trim() || 'https://www.scmfh.es/ver_datos.asp?id_sec=5';
export const SCMFH_UNIT_DOSE_TEMP_DIR = process.env.SCMFH_UNIT_DOSE_TEMP_DIR?.trim() || './tmp/unit-dose';

export type UnitDoseSourceMode = 'direct' | 'discovered';

export type PreparedUnitDoseSource = {
  filePath: string;
  sourceMode: UnitDoseSourceMode;
  sourceUrl: string;
  downloadedBytes: number;
  cleanup: () => Promise<void>;
};

function getDownloadFileName(sourceUrl: string): string {
  const parsedUrl = new URL(sourceUrl);
  const fileName = basename(decodeURIComponent(parsedUrl.pathname));

  if (/\.xlsx?$/i.test(fileName)) {
    return fileName;
  }

  return `unit-dose-${Date.now()}.xls`;
}

async function fetchOk(url: string): Promise<Response> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`No se pudo descargar la fuente SCMFH (${response.status} ${response.statusText}).`);
  }

  return response;
}

function decodeHtmlAttribute(value: string): string {
  return value.replace(/&amp;/gi, '&');
}

function discoverSpreadsheetUrl(html: string, pageUrl: string): string {
  const hrefPattern = /href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi;

  for (const match of html.matchAll(hrefPattern)) {
    const href = decodeHtmlAttribute(match[1] ?? match[2] ?? match[3] ?? '');
    if (/\.xlsx?(?:[?#]|$)/i.test(href)) {
      return new URL(href, pageUrl).toString();
    }
  }

  throw new Error('No se encontró ningún enlace .xls/.xlsx en la página SCMFH.');
}

async function resolveSource(): Promise<{ sourceMode: UnitDoseSourceMode; sourceUrl: string }> {
  if (SCMFH_UNIT_DOSE_XLS_URL) {
    return {
      sourceMode: 'direct',
      sourceUrl: SCMFH_UNIT_DOSE_XLS_URL,
    };
  }

  const response = await fetchOk(SCMFH_UNIT_DOSE_PAGE_URL);
  const html = await response.text();

  return {
    sourceMode: 'discovered',
    sourceUrl: discoverSpreadsheetUrl(html, SCMFH_UNIT_DOSE_PAGE_URL),
  };
}

async function downloadToTempFile(sourceUrl: string): Promise<{ filePath: string; downloadedBytes: number }> {
  const response = await fetchOk(sourceUrl);
  const arrayBuffer = await response.arrayBuffer();
  const downloadedBytes = arrayBuffer.byteLength;
  const fileName = getDownloadFileName(sourceUrl);
  const filePath = join(SCMFH_UNIT_DOSE_TEMP_DIR, `${Date.now()}-${fileName}`);

  await mkdir(SCMFH_UNIT_DOSE_TEMP_DIR, { recursive: true });
  await writeFile(filePath, Buffer.from(arrayBuffer));

  return { filePath, downloadedBytes };
}

export async function prepareUnitDoseSource(): Promise<PreparedUnitDoseSource> {
  const { sourceMode, sourceUrl } = await resolveSource();
  const { filePath, downloadedBytes } = await downloadToTempFile(sourceUrl);

  return {
    filePath,
    sourceMode,
    sourceUrl,
    downloadedBytes,
    cleanup: async () => {
      await unlink(filePath).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      });
    },
  };
}
