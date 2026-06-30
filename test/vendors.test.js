'use strict';

const { findCanonical } = require('../lib/vendors');

const cases = [
  // Casing fixes
  ['nike',              'Nike'],
  ['ADIDAS',           'Adidas'],
  ['the north face',   'The North Face'],
  ['hoka',             'HOKA'],
  ['hummel',           'Hummel'],
  ['under armour',     'Under Armour'],
  // Typos / fuzzy
  ['Addidas',          'Adidas'],
  ['Saloomon',         'Salomon'],
  ['New Ballance',     'New Balance'],
  ['Convers',          'Converse'],
  ['Helly Hansen',     'Helly Hansen'],
  // Already correct — should return same string
  ['Nike',             'Nike'],
  ['The North Face',   'The North Face'],
  // Unknown brand — should return null
  ['BrandXYZ',         null],
  ['Unknown',          null],
];

let passed = 0;
let failed = 0;

for (const [input, expected] of cases) {
  const result = findCanonical(input);
  const ok = result === expected;
  if (ok) {
    passed++;
    console.log(`✓  "${input}" → "${result}"`);
  } else {
    failed++;
    console.error(`✗  "${input}" → got "${result}", expected "${expected}"`);
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
