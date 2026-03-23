import { createRequire } from 'node:module';

import { prisma } from '@/lib/prisma';
import type { ScheduledJobExecutionResult } from '@/lib/scheduled-jobs';

const require = createRequire(import.meta.url);
const { importNomenclatorFromFile } = require('./nomenclator-import.cjs') as {
  importNomenclatorFromFile: (inputPath: string, options?: { cwd?: string }) => Promise<Record<string, unknown>>;
};

type NomenclatorUpdateSummary = {
  processed: number;
  insertedOrUpdated: number;
  discarded: number;
  source: string | null;
  file: string | null;
};

export type NomenclatorJobRunOverview = {
  id: string;
  requestedAt: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  processed: number | null;
  insertedOrUpdated: number | null;
  discarded: number | null;
  source: string | null;
  file: string | null;
};

function resolveConfiguredNomenclatorXmlPath(): string {
  const configuredPath = process.env.NOMENCLATOR_XML_PATH?.trim();

  if (!configuredPath) {
    throw new Error('Falta NOMENCLATOR_XML_PATH para ejecutar el job programado del Nomenclátor.');
  }

  return configuredPath;
}

function normalizeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function normalizeNomenclatorSummary(summary: Record<string, unknown>): NomenclatorUpdateSummary {
  return {
    processed: normalizeNumber(summary.processed) ?? 0,
    insertedOrUpdated: normalizeNumber(summary.insertedOrUpdated) ?? 0,
    discarded: normalizeNumber(summary.discarded) ?? 0,
    source: normalizeString(summary.source),
    file: normalizeString(summary.file),
  };
}

export async function executeNomenclatorUpdate(): Promise<ScheduledJobExecutionResult> {
  const xmlPath = resolveConfiguredNomenclatorXmlPath();
  const rawSummary = await importNomenclatorFromFile(xmlPath, { cwd: process.cwd() });
  const summary = normalizeNomenclatorSummary(rawSummary);

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

export async function executeScheduledNomenclatorUpdate(): Promise<ScheduledJobExecutionResult> {
  return executeNomenclatorUpdate();
}

export async function getLatestNomenclatorJobRun(): Promise<NomenclatorJobRunOverview | null> {
  const latestRun = await prisma.scheduledJobRun.findFirst({
    where: {
      jobName: 'NOMENCLATOR_UPDATE',
    },
    orderBy: {
      startedAt: 'desc',
    },
    select: {
      id: true,
      requestedAt: true,
      startedAt: true,
      finishedAt: true,
      status: true,
      summaryJson: true,
    },
  });

  if (!latestRun) {
    return null;
  }

  let parsedSummary: Record<string, unknown> = {};

  if (latestRun.summaryJson) {
    try {
      parsedSummary = JSON.parse(latestRun.summaryJson) as Record<string, unknown>;
    } catch {
      parsedSummary = {};
    }
  }

  const summary = normalizeNomenclatorSummary(parsedSummary);

  return {
    id: latestRun.id,
    requestedAt: latestRun.requestedAt.toISOString(),
    startedAt: latestRun.startedAt.toISOString(),
    finishedAt: latestRun.finishedAt?.toISOString() ?? null,
    status: latestRun.status,
    processed: summary.processed,
    insertedOrUpdated: summary.insertedOrUpdated,
    discarded: summary.discarded,
    source: summary.source,
    file: summary.file,
  };
}