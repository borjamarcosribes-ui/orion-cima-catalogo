import { describe, expect, it } from 'vitest';

import { discoverExcelLinkFromHtml } from '../lib/unit-dose-download';

describe('discoverExcelLinkFromHtml', () => {
  it('finds the first reasonable Excel link in HTML', () => {
    const html = `
      <a href="/documentos/info.pdf">PDF</a>
      <a href="https://scmfh.example/files/MEDICAMENTOSACTIVOS.xlsx">Excel</a>
      <a href="https://scmfh.example/files/otro.xls">Otro Excel</a>
    `;

    expect(discoverExcelLinkFromHtml(html, 'https://scmfh.example/ver_datos.asp?id_sec=5')).toBe(
      'https://scmfh.example/files/MEDICAMENTOSACTIVOS.xlsx',
    );
  });

  it('resolves relative Excel URLs against the page URL', () => {
    const html = '<a href="../descargas/MEDICAMENTOSACTIVOS.xls">Descargar</a>';

    expect(discoverExcelLinkFromHtml(html, 'https://www.scmfh.es/seccion/ver_datos.asp?id_sec=5')).toBe(
      'https://www.scmfh.es/descargas/MEDICAMENTOSACTIVOS.xls',
    );
  });

  it('keeps query strings when resolving Excel URLs', () => {
    const html = '<a href="/download/MEDICAMENTOSACTIVOS.xlsx?version=1&amp;token=abc">Excel</a>';

    expect(discoverExcelLinkFromHtml(html, 'https://www.scmfh.es/ver_datos.asp?id_sec=5')).toBe(
      'https://www.scmfh.es/download/MEDICAMENTOSACTIVOS.xlsx?version=1&token=abc',
    );
  });

  it('returns null when the page has no Excel link', () => {
    const html = '<a href="/documentos/info.pdf">PDF</a>';

    expect(discoverExcelLinkFromHtml(html, 'https://www.scmfh.es/ver_datos.asp?id_sec=5')).toBeNull();
  });
});
