import { createRequire } from 'node:module';

import type { ScheduledJobExecutionResult } from '@/lib/scheduled-jobs';

const require = createRequire(import.meta.url);
const { importNomenclatorFromFile } = require('./nomenclator-import.cjs') as {
  importNomenclatorFromFile: (inputPath: string, options?: { cwd?: string }) => Promise<Record<string, unknown>>;
};

function resolveConfiguredNomenclatorXmlPath(): string {
  const configuredPath = process.env.NOMENCLATOR_XML_PATH?.trim();

  if (!configuredPath) {
    throw new Error('Falta NOMENCLATOR_XML_PATH para ejecutar el job programado del Nomenclátor.');
  }

  return configuredPath;
}

export async function executeScheduledNomenclatorUpdate(): Promise<ScheduledJobExecutionResult> {
  const xmlPath = resolveConfiguredNomenclatorXmlPath();
  const summary = await importNomenclatorFromFile(xmlPath, { cwd: process.cwd() });

  return {
    status: 'completed',
    summary: {
      sourceMode: 'local_xml_path',
      zipDownloadImplemented: false,
      ...summary,
    },
    errors: null,
  };
}