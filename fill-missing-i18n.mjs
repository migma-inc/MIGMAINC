/**
 * fill-missing-i18n.mjs
 * Preenche chaves faltando em ES e FR copiando do PT com prefixo [TRADUZIR].
 *
 * Uso: node fill-missing-i18n.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = path.join(__dirname, 'src/locales');

/** Deep-merge: para cada chave em `source` que não existe em `target`, insere com prefixo. */
function fillMissing(target, source, prefix = '[TRADUZIR] ') {
  let added = 0;
  for (const [key, val] of Object.entries(source)) {
    if (!(key in target)) {
      // Chave totalmente ausente — insere tudo com prefixo
      target[key] = addPrefix(val, prefix);
      added++;
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      // Ambos são objetos — desce recursivamente
      if (typeof target[key] !== 'object' || target[key] === null) {
        target[key] = {};
      }
      added += fillMissing(target[key], val, prefix);
    }
    // Se já existe e não é objeto, mantém o valor existente
  }
  return added;
}

/** Adiciona prefixo a todas as strings dentro de um valor (recursivo para objetos). */
function addPrefix(val, prefix) {
  if (typeof val === 'string') {
    return prefix + val;
  }
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    const out = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = addPrefix(v, prefix);
    }
    return out;
  }
  return val;
}

function loadJson(lang) {
  return JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, `${lang}.json`), 'utf8'));
}

function saveJson(lang, data) {
  fs.writeFileSync(
    path.join(LOCALES_DIR, `${lang}.json`),
    JSON.stringify(data, null, 4),
    'utf8'
  );
}

console.log('\n╔══════════════════════════════════════════════════╗');
console.log('║        FILL-MISSING-I18N — Migma LP              ║');
console.log('╚══════════════════════════════════════════════════╝\n');

const pt = loadJson('pt');

for (const lang of ['es', 'fr']) {
  const target = loadJson(lang);
  const before = JSON.stringify(target).length;

  const added = fillMissing(target, pt);

  saveJson(lang, target);

  console.log(`✅ ${lang.toUpperCase()}: ${added} chaves preenchidas com [TRADUZIR]`);
}

console.log('\nPronto! Agora rode: node check-i18n.mjs para confirmar.\n');
