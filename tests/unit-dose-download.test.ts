import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };

async function loadDownloader(env: Record<string, string | undefined>) {
  vi.resetModules();
  process.env = { ...originalEnv, ...env };
  return import('../lib/unit-dose-download');
}

afterEach(() => {
  vi.restoreAllMocks();
  process.env = { ...originalEnv };
});

describe('SCMFH unit dose downloader', () => {
  it('downloads a direct XLS URL to a temporary file and cleans it up', async () => {
    const tempDir = join(tmpdir(), `unit-dose-direct-${Date.now()}`);
    const body = Buffer.from('excel-content');
    const fetchMock = vi.fn().mockResolvedValue(new Response(body));
    vi.stubGlobal('fetch', fetchMock);

    const { prepareUnitDoseSource } = await loadDownloader({
      SCMFH_UNIT_DOSE_XLS_URL: 'https://scmfh.example/MEDICAMENTOSACTIVOS.xls',
      SCMFH_UNIT_DOSE_PAGE_URL: 'https://scmfh.example/page',
      SCMFH_UNIT_DOSE_TEMP_DIR: tempDir,
    });

    const source = await prepareUnitDoseSource();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('https://scmfh.example/MEDICAMENTOSACTIVOS.xls');
    expect(source.sourceMode).toBe('direct');
    expect(source.sourceUrl).toBe('https://scmfh.example/MEDICAMENTOSACTIVOS.xls');
    expect(source.downloadedBytes).toBe(body.byteLength);
    await expect(readFile(source.filePath, 'utf8')).resolves.toBe('excel-content');

    await source.cleanup();
    await expect(access(source.filePath)).rejects.toThrow();
  });

  it('discovers the first relative XLS/XLSX link from the SCMFH page', async () => {
    const tempDir = join(tmpdir(), `unit-dose-discovered-${Date.now()}`);
    const pageHtml = '<html><a href="/download/MEDICAMENTOSACTIVOS.xlsx?version=1&amp;token=abc">Unidosis</a></html>';
    const body = Buffer.from('xlsx-content');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(pageHtml, { headers: { 'content-type': 'text/html' } }))
      .mockResolvedValueOnce(new Response(body));
    vi.stubGlobal('fetch', fetchMock);

    const { prepareUnitDoseSource } = await loadDownloader({
      SCMFH_UNIT_DOSE_XLS_URL: '',
      SCMFH_UNIT_DOSE_PAGE_URL: 'https://www.scmfh.es/ver_datos.asp?id_sec=5',
      SCMFH_UNIT_DOSE_TEMP_DIR: tempDir,
    });

    const source = await prepareUnitDoseSource();

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://www.scmfh.es/ver_datos.asp?id_sec=5');
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://www.scmfh.es/download/MEDICAMENTOSACTIVOS.xlsx?version=1&token=abc',
    );
    expect(source.sourceMode).toBe('discovered');
    expect(source.sourceUrl).toBe('https://www.scmfh.es/download/MEDICAMENTOSACTIVOS.xlsx?version=1&token=abc');
    expect(source.downloadedBytes).toBe(body.byteLength);
    await expect(readFile(source.filePath, 'utf8')).resolves.toBe('xlsx-content');

    await source.cleanup();
  });

  it('fails before downloading when the SCMFH page has no spreadsheet link', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('<html>sin enlace</html>'));
    vi.stubGlobal('fetch', fetchMock);

    const { prepareUnitDoseSource } = await loadDownloader({
      SCMFH_UNIT_DOSE_XLS_URL: '',
      SCMFH_UNIT_DOSE_PAGE_URL: 'https://www.scmfh.es/ver_datos.asp?id_sec=5',
      SCMFH_UNIT_DOSE_TEMP_DIR: join(tmpdir(), `unit-dose-missing-${Date.now()}`),
    });

    await expect(prepareUnitDoseSource()).rejects.toThrow('No se encontró ningún enlace .xls/.xlsx');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
