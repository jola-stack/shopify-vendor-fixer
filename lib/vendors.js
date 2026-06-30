'use strict';

const CANONICAL_VENDORS = [
  '8848',
  'Adidas',
  'Adidas Originals',
  'Aero Sport',
  'Aqua Lung',
  'Aqua Sphere',
  'Arena',
  'Asics',
  'AZENZION',
  'Babolat',
  'Björn Borg',
  'Blue',
  'Brooks',
  'Buff',
  'Bullpadel',
  'Bundgaard',
  'Carite',
  'Cartri',
  'Casall',
  'CEP',
  'Champion',
  'CMP',
  'Columbia',
  'Converse',
  'Craft',
  'Crep Protect',
  'Diadora',
  'DUP',
  'ECCO',
  'Enebe',
  'Energetics',
  'Etirel',
  'Falke',
  'fe226',
  'Fila',
  'Firefly',
  'fitnessDk',
  'Five Seasons',
  'Footbalance',
  'Fruit of the Loom',
  'FunZone',
  'FZ Forza',
  'G-Form',
  'Garmin',
  'GripGrab',
  'H2O',
  'Haglöfs',
  'Harrows',
  'Havaianas',
  'Head',
  'Helly Hansen',
  'Hestra',
  'Highactive',
  'HOKA',
  'Hummel',
  'ICANIWILL',
  'INTERSPORT',
  'ITS',
  'Jack Wolfskin',
  'JBL',
  'JBS',
  'Joma',
  'Jordan',
  'K2',
  'Kangol',
  'Kappa',
  'Kari Traa',
  'Kempa',
  'Klitmøller Rig Wear',
  'Le Coq Sportif',
  'Les Deux Athletics',
  'liiteGuard',
  'Lykke R',
  'Lykkeliga',
  'Massive',
  'McKinley',
  'Merrell',
  'MessyWeekend',
  'Mizuno',
  'Nakamura',
  'New Balance',
  'New Era',
  'Newline',
  'Nike',
  'Nobrand',
  'Northbrook',
  'NOX',
  'Oakley',
  'Odense Boldklub',
  'On',
  'Outwell',
  'PadelPower',
  'Peak Performance',
  'Primus',
  'Prolimit',
  'Pro Touch',
  'Puma',
  'Purelime',
  'Quicklaze',
  'Quiksilver',
  'RE DO',
  'Reebok',
  'Reef',
  'Reima',
  'Reusch',
  'Robens',
  'Ruggedgear',
  'Salomon',
  'Santini',
  'Saucony',
  'Select',
  'Sidas',
  'Skechers',
  'SmellWell',
  'Sorel',
  'Speedo',
  'Sport Direct',
  'Sportsbuddy',
  'Stance',
  'Staple X TAF',
  'State of WOW',
  'Stiga',
  'STX',
  'Superdry',
  'Tecnopro',
  'Tenson',
  'Teva',
  'The Athletes Foot',
  'The North Face',
  'Timberland',
  'Tommy Hilfiger',
  'Touch9',
  'Tour de France',
  'Trendy',
  'Under Armour',
  'U.S. Polo Assn.',
  'Vans',
  'Vertical',
  'Vibor-A',
  'Viking Footwear',
  'Volt Padel',
  'Warrior Shanghai',
  'Waterfly',
  'Wave Wizard',
  'Weather Report',
  'Westford Mill',
  'Wilson',
  'Wow',
  'Yonex',
  'Zanier',
  'Zebla',
  'ZigZag',
];

// Precompute lookup maps for speed
const exactSet = new Set(CANONICAL_VENDORS);
const lowerMap = new Map(CANONICAL_VENDORS.map(v => [v.toLowerCase(), v]));
const normalizedMap = new Map(CANONICAL_VENDORS.map(v => [normalize(v), v]));

function normalize(s) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// Returns the canonical vendor name if a match is found, otherwise null.
// Returns null (not the input) when there's no match — unknown brands are left untouched.
function findCanonical(vendor) {
  if (!vendor || typeof vendor !== 'string') return null;
  const trimmed = vendor.trim();

  // 1. Already correct
  if (exactSet.has(trimmed)) return trimmed;

  // 2. Case mismatch
  const lower = trimmed.toLowerCase();
  if (lowerMap.has(lower)) return lowerMap.get(lower);

  // 3. Normalized match (ignores spaces, hyphens, dots, etc.)
  const norm = normalize(trimmed);
  if (norm.length < 2) return null; // too short to fuzzy-match safely
  if (normalizedMap.has(norm)) return normalizedMap.get(norm);

  // 4. Fuzzy match via Levenshtein — only for strings long enough to avoid false positives
  if (norm.length >= 4) {
    const maxDist = norm.length <= 6 ? 1 : 2;
    let bestDist = maxDist + 1;
    let bestMatch = null;
    for (const [normCanon, canon] of normalizedMap) {
      if (Math.abs(normCanon.length - norm.length) > maxDist) continue;
      const dist = levenshtein(norm, normCanon);
      if (dist <= maxDist && dist < bestDist) {
        bestDist = dist;
        bestMatch = canon;
      }
    }
    if (bestMatch) return bestMatch;
  }

  return null;
}

module.exports = { CANONICAL_VENDORS, findCanonical };
