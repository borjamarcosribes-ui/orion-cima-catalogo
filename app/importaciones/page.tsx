import ImportsClient from '@/app/importaciones/imports-client';
import { saveTsvImportAction } from '@/app/importaciones/actions';
import { getTsvImportPreviewById, listTsvImportHistory } from '@/lib/tsv-imports';

export const dynamic = 'force-dynamic';

type ImportsPageProps = {
  searchParams?: Promise<{
    importId?: string;
  }>;
};

export default async function ImportsPage({ searchParams }: ImportsPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const importId = resolvedSearchParams?.importId?.trim();
  const history = await listTsvImportHistory();
  const initialPersistedImport = importId ? await getTsvImportPreviewById(importId) : null;

  return (
    <ImportsClient
      initialHistory={history}
      initialPersistedImport={initialPersistedImport}
      saveImportAction={saveTsvImportAction}
    />
  );
}