#!/usr/bin/env node
const { importNomenclatorFromFile } = require('../lib/nomenclator-import.cjs');

async function main() {
  const inputPath = process.argv[2];

  if (!inputPath) {
    throw new Error('Uso: npm run import:nomenclator -- <ruta-a-Prescripcion.xml|xlsx|csv|tsv>');
  }

  const summary = await importNomenclatorFromFile(inputPath, { cwd: process.cwd() });
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});