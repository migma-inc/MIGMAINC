/**
 * check-i18n.mjs
 * Verifica integridade das traduções i18n em 4 idiomas.
 *
 * Uso: node check-i18n.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LOCALES_DIR = path.join(__dirname, 'src/locales');
const SRC_DIR = path.join(__dirname, 'src');
const LANGS = ['pt', 'en', 'es', 'fr'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Achata objeto nested em dot-notation keys. Ex: { a: { b: 'x' } } → { 'a.b': 'x' } */
function flatten(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flatten(v, key));
    } else {
      out[key] = v;
    }
  }
  return out;
}

/** Lê e achata um locale JSON */
function loadLocale(lang) {
  const file = path.join(LOCALES_DIR, `${lang}.json`);
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  return flatten(raw);
}

/** Coleta recursivamente todos os .ts/.tsx em src/ */
function collectSrcFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSrcFiles(full));
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

/**
 * Extrai todas as chaves usadas via t('key') ou t("key") ou t(`key`) no código.
 * Também captura o segundo argumento (fallback) quando presente.
 */
function extractI18nUsages(srcFiles) {
  const usages = new Map(); // key → Set<file>

  // Regex para: t('key'), t("key"), t('key', 'fallback') etc.
  const RE = /\bt\(\s*['"`]([^'"`\s]+)['"`]/g;

  for (const file of srcFiles) {
    const content = fs.readFileSync(file, 'utf8');
    for (const match of content.matchAll(RE)) {
      const key = match[1];
      if (!usages.has(key)) usages.set(key, new Set());
      usages.get(key).add(path.relative(__dirname, file));
    }
  }
  return usages;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log('\n╔══════════════════════════════════════════════════╗');
console.log('║           CHECK-I18N — Migma LP                  ║');
console.log('╚══════════════════════════════════════════════════╝\n');

// 1. Carregar todos os locales
const locales = {};
for (const lang of LANGS) {
  locales[lang] = loadLocale(lang);
  console.log(`[locale] ${lang}: ${Object.keys(locales[lang]).length} chaves`);
}
console.log();

// 2. Todas as chaves únicas de todos os idiomas
const allKeys = new Set(LANGS.flatMap(l => Object.keys(locales[l])));
console.log(`[total] ${allKeys.size} chaves únicas no conjunto\n`);

// ─── Seção 1: Chaves faltando por idioma ──────────────────────────────────────
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  1. CHAVES FALTANDO POR IDIOMA');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

let totalMissing = 0;
for (const lang of LANGS) {
  const missing = [...allKeys].filter(k => !(k in locales[lang]));
  totalMissing += missing.length;
  if (missing.length === 0) {
    console.log(`✅ ${lang.toUpperCase()}: nenhuma chave faltando`);
  } else {
    console.log(`❌ ${lang.toUpperCase()}: ${missing.length} chaves faltando`);
    for (const k of missing.sort()) {
      console.log(`   • ${k}`);
    }
  }
  console.log();
}

// ─── Seção 2: Valores idênticos entre idiomas (possível tradução esquecida) ───
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  2. VALORES IGUAIS AO PT (possível não traduzido)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const NON_PT_LANGS = ['en', 'es', 'fr'];
for (const lang of NON_PT_LANGS) {
  const suspects = [];
  for (const key of Object.keys(locales[lang])) {
    const val = locales[lang][key];
    const ptVal = locales['pt'][key];
    if (
      ptVal !== undefined &&
      val === ptVal &&
      typeof val === 'string' &&
      val.length > 3 &&
      !/^\d+$/.test(val) // ignora valores que são só números
    ) {
      suspects.push({ key, val });
    }
  }
  if (suspects.length === 0) {
    console.log(`✅ ${lang.toUpperCase()}: sem valores suspeitos`);
  } else {
    console.log(`⚠️  ${lang.toUpperCase()}: ${suspects.length} valores iguais ao PT`);
    for (const { key, val } of suspects.slice(0, 30)) {
      const display = val.length > 60 ? val.slice(0, 57) + '...' : val;
      console.log(`   • ${key}: "${display}"`);
    }
    if (suspects.length > 30) {
      console.log(`   ... e mais ${suspects.length - 30} chaves`);
    }
  }
  console.log();
}

// ─── Seção 3: Chaves usadas no código mas faltando nos locales ────────────────
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  3. CHAVES DO CÓDIGO NÃO ENCONTRADAS NOS LOCALES');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const srcFiles = collectSrcFiles(SRC_DIR);
const usages = extractI18nUsages(srcFiles);

console.log(`[scan] ${srcFiles.length} arquivos escaneados, ${usages.size} chaves únicas no código\n`);

const missingInAny = [];
for (const [key, files] of [...usages.entries()].sort()) {
  const missingIn = LANGS.filter(l => !(key in locales[l]));
  if (missingIn.length > 0) {
    missingInAny.push({ key, missingIn, files: [...files] });
  }
}

if (missingInAny.length === 0) {
  console.log('✅ Todas as chaves do código estão nos locales');
} else {
  console.log(`❌ ${missingInAny.length} chaves do código faltam em algum idioma:\n`);
  for (const { key, missingIn, files } of missingInAny) {
    console.log(`  • ${key}`);
    console.log(`    falta em: [${missingIn.join(', ')}]`);
    console.log(`    usado em: ${files.slice(0, 3).join(', ')}${files.length > 3 ? ` +${files.length - 3}` : ''}`);
  }
}
console.log();

// ─── Seção 4: Chaves nos locales nunca usadas no código ───────────────────────
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  4. CHAVES NOS LOCALES SEM USO NO CÓDIGO (órfãs)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Usa pt como referência (idioma base)
const orphans = [...Object.keys(locales['pt'])].filter(k => !usages.has(k));
if (orphans.length === 0) {
  console.log('✅ Nenhuma chave órfã');
} else {
  console.log(`⚠️  ${orphans.length} chaves órfãs no PT (sem uso detectado no código):`);
  for (const k of orphans.sort()) {
    console.log(`   • ${k}`);
  }
}
console.log();

// ─── Resumo ───────────────────────────────────────────────────────────────────
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  RESUMO');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log(`  Chaves faltando nos locales:    ${totalMissing}`);
console.log(`  Chaves do código sem locale:    ${missingInAny.length}`);
console.log(`  Chaves órfãs (PT sem uso):      ${orphans.length}`);
console.log();
