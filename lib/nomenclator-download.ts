import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, mkdir, open, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeWebReadableStream } from 'node:stream/web';
import { pipeline } from 'node:stream/promises';
import { createInflateRaw } from 'node:zlib';

type NomenclatorPreparedSource = {
  cleanup: () => Promise<void>;
  downloadedZipBytes: number | null;
  extractedXmlPath: string | null;
  sourceMode: 'zip_download' | 'local_xml_path';
  xmlPath: string;
  zipUrl: string | null;
};

type ZipEntry = {
  compressedSize: number;
  compressionMethod: number;
  fileName: string;
  localHeaderOffset: number;
};

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_FILE_HEADER_SIGNATURE = 0x02014b50;
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const MAX_EOCD_SEARCH = 65557;

function resolveConfiguredLocalXmlPath(): string {
  const configuredPath = process.env.NOMENCLATOR_XML_PATH?.trim();

  if (!configuredPath) {
    throw new Error(
      'Falta NOMENCLATOR_ZIP_URL y también NOMENCLATOR_XML_PATH. Configura la URL del ZIP oficial o una ruta local a Prescripcion.xml.',
    );
  }

  return configuredPath;
}

async function createTempDirectory(): Promise<string> {
  const configuredBaseDir = process.env.NOMENCLATOR_TEMP_DIR?.trim();
  const baseDir = configuredBaseDir ? path.resolve(configuredBaseDir) : os.tmpdir();

  await mkdir(baseDir, { recursive: true });
  return mkdtemp(path.join(baseDir, 'orion-nomenclator-'));
}

async function downloadZipToFile(zipUrl: string, zipFilePath: string): Promise<number> {
  const response = await fetch(zipUrl);

  if (!response.ok || !response.body) {
    throw new Error(`No se pudo descargar el ZIP del Nomenclátor (${response.status} ${response.statusText}).`);
  }

  const output = createWriteStream(zipFilePath);
  await pipeline(Readable.fromWeb(response.body as unknown as NodeWebReadableStream), output);

  const downloadedLength = response.headers.get('content-length');
  if (downloadedLength && /^\d+$/.test(downloadedLength)) {
    return Number(downloadedLength);
  }

  const fileStats = await stat(zipFilePath);
  return fileStats.size;
}

async function findZipEntry(zipFilePath: string, targetBaseName: string): Promise<ZipEntry> {
  const fileStats = await stat(zipFilePath);
  const fileHandle = await open(zipFilePath, 'r');

  try {
    const tailSize = Math.min(fileStats.size, MAX_EOCD_SEARCH);
    const tailBuffer = Buffer.alloc(tailSize);
    await fileHandle.read(tailBuffer, 0, tailSize, fileStats.size - tailSize);

    let eocdOffset = -1;
    for (let index = tailBuffer.length - 22; index >= 0; index -= 1) {
      if (tailBuffer.readUInt32LE(index) === EOCD_SIGNATURE) {
        eocdOffset = index;
        break;
      }
    }

    if (eocdOffset === -1) {
      throw new Error('El ZIP descargado no tiene un directorio central válido.');
    }

    const totalEntries = tailBuffer.readUInt16LE(eocdOffset + 10);
    const centralDirectoryOffset = tailBuffer.readUInt32LE(eocdOffset + 16);

    let currentOffset = centralDirectoryOffset;
    for (let entryIndex = 0; entryIndex < totalEntries; entryIndex += 1) {
      const headerBuffer = Buffer.alloc(46);
      await fileHandle.read(headerBuffer, 0, headerBuffer.length, currentOffset);

      if (headerBuffer.readUInt32LE(0) !== CENTRAL_FILE_HEADER_SIGNATURE) {
        throw new Error('El ZIP descargado tiene una cabecera central no válida.');
      }

      const compressionMethod = headerBuffer.readUInt16LE(10);
      const compressedSize = headerBuffer.readUInt32LE(20);
      const fileNameLength = headerBuffer.readUInt16LE(28);
      const extraFieldLength = headerBuffer.readUInt16LE(30);
      const fileCommentLength = headerBuffer.readUInt16LE(32);
      const localHeaderOffset = headerBuffer.readUInt32LE(42);

      const fileNameBuffer = Buffer.alloc(fileNameLength);
      await fileHandle.read(fileNameBuffer, 0, fileNameLength, currentOffset + 46);
      const fileName = fileNameBuffer.toString('utf8');

      if (path.basename(fileName).toLowerCase() === targetBaseName.toLowerCase()) {
        return {
          compressedSize,
          compressionMethod,
          fileName,
          localHeaderOffset,
        };
      }

      currentOffset += 46 + fileNameLength + extraFieldLength + fileCommentLength;
    }
  } finally {
    await fileHandle.close();
  }

  throw new Error(`El ZIP descargado no contiene ${targetBaseName}.`);
}

async function extractZipEntryToFile(zipFilePath: string, entry: ZipEntry, outputPath: string): Promise<void> {
  const fileHandle = await open(zipFilePath, 'r');

  try {
    const localHeaderBuffer = Buffer.alloc(30);
    await fileHandle.read(localHeaderBuffer, 0, localHeaderBuffer.length, entry.localHeaderOffset);

    if (localHeaderBuffer.readUInt32LE(0) !== LOCAL_FILE_HEADER_SIGNATURE) {
      throw new Error('El ZIP descargado tiene una cabecera local no válida.');
    }

    const fileNameLength = localHeaderBuffer.readUInt16LE(26);
    const extraFieldLength = localHeaderBuffer.readUInt16LE(28);
    const dataStart = entry.localHeaderOffset + 30 + fileNameLength + extraFieldLength;
    const dataEnd = dataStart + entry.compressedSize - 1;

    const input = createReadStream(zipFilePath, { start: dataStart, end: dataEnd });
    const output = createWriteStream(outputPath);

    if (entry.compressionMethod === 0) {
      await pipeline(input, output);
      return;
    }

    if (entry.compressionMethod === 8) {
      await pipeline(input, createInflateRaw(), output);
      return;
    }

    throw new Error(`Método de compresión ZIP no soportado para ${entry.fileName} (${entry.compressionMethod}).`);
  } finally {
    await fileHandle.close();
  }
}

export async function prepareNomenclatorSource(): Promise<NomenclatorPreparedSource> {
  const configuredZipUrl = process.env.NOMENCLATOR_ZIP_URL?.trim();

  if (!configuredZipUrl) {
    return {
      sourceMode: 'local_xml_path',
      zipUrl: null,
      downloadedZipBytes: null,
      extractedXmlPath: null,
      xmlPath: resolveConfiguredLocalXmlPath(),
      cleanup: async () => {},
    };
  }

  const tempDir = await createTempDirectory();
  const zipFilePath = path.join(tempDir, 'nomenclator.zip');
  const xmlOutputPath = path.join(tempDir, 'Prescripcion.xml');

  try {
    const downloadedZipBytes = await downloadZipToFile(configuredZipUrl, zipFilePath);
    const xmlEntry = await findZipEntry(zipFilePath, 'Prescripcion.xml');
    await extractZipEntryToFile(zipFilePath, xmlEntry, xmlOutputPath);

    return {
      sourceMode: 'zip_download',
      zipUrl: configuredZipUrl,
      downloadedZipBytes,
      extractedXmlPath: xmlOutputPath,
      xmlPath: xmlOutputPath,
      cleanup: async () => {
        await rm(tempDir, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true });
    throw error;
  }
}