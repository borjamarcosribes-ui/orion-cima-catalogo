#!/usr/bin/env node
const { importUnitDoseCache } = require('../lib/unit-dose-import.cjs');

async function main() {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error('Uso: node scripts/import-unit-dose-cache.cjs /ruta/al/MEDICAMENTOSACTIVOS.xls');
    process.exitCode = 1;
    return;
  }

  const summary = await importUnitDoseCache(filePath);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error('Error importando la caché de unidosis de SCMFH:');
  console.error(error);
  process.exitCode = 1;
});
