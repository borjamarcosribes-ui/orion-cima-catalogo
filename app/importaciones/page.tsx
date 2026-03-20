import ImportsClient from '@/app/importaciones/imports-client';
import { saveTsvImportAction } from '@/app/importaciones/actions';
import { listTsvImportHistory } from '@/lib/tsv-imports';

export const dynamic = 'force-dynamic';

export default async function ImportsPage() {
  const history = await listTsvImportHistory();

  return <ImportsClient initialHistory={history} saveImportAction={saveTsvImportAction} />;
}