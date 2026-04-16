const { PrismaClient: SqlitePrismaClient } = require('@prisma/client');
const { PrismaClient: PostgresPrismaClient } = require('../generated/postgres-client');

const POSTGRES_DATABASE_URL = process.env.POSTGRES_DATABASE_URL;

if (!POSTGRES_DATABASE_URL) {
  throw new Error('Falta POSTGRES_DATABASE_URL en el entorno.');
}

const sqlite = new SqlitePrismaClient();
const postgres = new PostgresPrismaClient({
  datasources: {
    db: {
      url: POSTGRES_DATABASE_URL,
    },
  },
});

const BATCH_SIZE = 500;

const MODELS_IN_INSERT_ORDER = [
  'appUser',
  'importBatch',
  'rawImportRow',
  'medicineSnapshot',
  'medicineMaster',
  'cimaCache',
  'cimaCharacteristicCache',
  'supplyAlert',
  'localAnnotation',
  'tsvImport',
  'tsvImportItem',
  'watchedMedicine',
  'supplyStatus',
  'supplyMonitorRun',
  'supplyMonitoringEvent',
  'nomenclatorProduct',
  'bifimedCache',
  'bifimedIndicationCache',
  'scheduledJobRun',
  'executionLock',
  'supplyNotificationSubscription',
  'supplyNotificationRun',
];

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function clearTargetDatabase() {
  console.log('🧹 Limpiando tablas destino en Postgres...');

  for (const model of [...MODELS_IN_INSERT_ORDER].reverse()) {
    await postgres[model].deleteMany({});
    console.log(`   - ${model}: limpiado`);
  }
}

async function copyModel(model) {
  const sourceRows = await sqlite[model].findMany();
  console.log(`📦 ${model}: ${sourceRows.length} filas encontradas en SQLite`);

  if (sourceRows.length === 0) {
    const targetCount = await postgres[model].count();
    if (targetCount !== 0) {
      throw new Error(`La tabla ${model} debería quedar vacía en Postgres, pero tiene ${targetCount} filas.`);
    }
    console.log(`   ✓ ${model}: sin datos, OK`);
    return;
  }

  const batches = chunkArray(sourceRows, BATCH_SIZE);

  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index];
    await postgres[model].createMany({
      data: batch,
    });
    console.log(`   → ${model}: lote ${index + 1}/${batches.length} insertado (${batch.length} filas)`);
  }

  const targetCount = await postgres[model].count();

  if (targetCount !== sourceRows.length) {
    throw new Error(
      `Conteo no coincide en ${model}. SQLite=${sourceRows.length}, Postgres=${targetCount}`,
    );
  }

  console.log(`   ✓ ${model}: migrado correctamente (${targetCount} filas)`);
}

async function main() {
  console.log('🚀 Iniciando migración SQLite -> Postgres');
  console.log(`📍 Modelos a migrar: ${MODELS_IN_INSERT_ORDER.length}`);

  await clearTargetDatabase();

  for (const model of MODELS_IN_INSERT_ORDER) {
    await copyModel(model);
  }

  console.log('✅ Migración completada correctamente');
}

main()
  .catch((error) => {
    console.error('❌ Error en la migración');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sqlite.$disconnect();
    await postgres.$disconnect();
  });