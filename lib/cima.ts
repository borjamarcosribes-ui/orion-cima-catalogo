export type CimaCacheRecord = {
  nationalCode: string;
  officialName: string | null;
  activeIngredient: string | null;
  atcCode: string | null;
  laboratory: string | null;
  commercializationStatus: string | null;
  supplyStatus: string | null;
  payload: Record<string, unknown> | null;
  fetchedAt: string | null;
};

export type CimaIntegrationBacklog = {
  objective: string;
  status: 'ready' | 'pending-real-data';
  notes: string;
};

export const cimaIntegrationChecklist: CimaIntegrationBacklog[] = [
  {
    objective: 'Persistir caché local por CN para no depender de llamadas en tiempo real por fila.',
    status: 'ready',
    notes: 'El modelo cima_cache ya contempla payload normalizado y sello temporal de refresco, aunque la integración real sigue pendiente.',
  },
  {
    objective: 'Cruzar incidencias de suministro sobre el catálogo operativo.',
    status: 'ready',
    notes: 'El modelo supply_alerts queda separado para permitir histórico y auditoría cuando exista persistencia real.',
  },
  {
    objective: 'Ajustar el enriquecimiento cuando se valide el XLS real de Orion.',
    status: 'pending-real-data',
    notes: 'Falta confirmar qué columnas locales conviene conservar en medicines_master y local_annotations cuando llegue el XLS real.',
  },
];
