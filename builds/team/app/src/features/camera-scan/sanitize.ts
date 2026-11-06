// Reduces a provider reply to the response schema and cleans labels (CS-4, CS-6, X-11).
// The app never trusts the model to follow the prompt: every label is cleaned here.
export type IdentifyStatus = 'identified' | 'unclear' | 'multiple';
export interface Reduced {
  status: IdentifyStatus;
  label: string | null;
  candidates: string[];
  // true when an identified label was non-empty before cleaning and empty after
  emptiedByCleaning: boolean;
}

export const MAX_LABEL = 120;
export const MAX_CANDIDATES = 4;

// Brand, company and device-line names that commonly appear on household items. A model that
// ignores the prompt is caught here; unknown brands are caught by the capitalization and
// digit rules below (documented in app/docs/camera-scan.md).
const BRANDS = [
  'coca-cola', 'coca cola', 'coke', 'diet coke', 'pepsi', 'sprite', 'fanta', 'mountain dew', 'dr pepper', 'dr. pepper',
  '7up', '7-up', 'dasani', 'aquafina', 'evian', 'fiji', 'poland spring', 'smartwater', 'snapple', 'gatorade',
  'powerade', 'red bull', 'monster energy', 'monster', 'la croix', 'lacroix', 'topo chico', 'perrier', 'san pellegrino',
  'starbucks', 'dunkin', 'dunkin donuts', "mcdonald's", 'mcdonalds', 'burger king', 'kfc', 'subway', 'chipotle',
  'taco bell', 'wendys', "wendy's", 'chick-fil-a', 'tide', 'clorox', 'lysol', 'windex', 'palmolive', 'charmin',
  'kleenex', 'bounty', 'ziploc', 'hefty', 'saran', 'reynolds', 'tupperware', 'rubbermaid', 'yeti',
  'hydro flask', 'nalgene', 'iphone', 'ipad', 'macbook', 'airpods', 'apple watch', 'samsung', 'galaxy',
  'google', 'pixel', 'sony', 'lg', 'dell', 'hp', 'lenovo', 'asus', 'acer', 'microsoft', 'xbox', 'playstation',
  'nintendo', 'bose', 'jbl', 'duracell', 'energizer', 'panasonic', 'rayovac', 'philips', 'nike', 'adidas',
  'amazon', 'kindle', 'alexa', 'fedex', 'ups', 'usps', 'dhl', 'walmart', 'costco', "trader joe's",
  'trader joes', 'whole foods', 'safeway', 'kroger', 'h-e-b', 'heb', 'dole', 'heinz', "campbell's", 'campbells', 'nestle',
  "kellogg's", 'kelloggs', 'cheerios', 'pringles', 'oreo', 'lays', "lay's", 'doritos', 'tabasco', 'skippy', 'jif',
  'nutella', 'lipton', 'folgers', 'maxwell house', 'keurig', 'nespresso', 'k-cup', 'tylenol', 'advil', 'band-aid',
  'bandaid', 'gillette', 'colgate', 'listerine', 'pampers', 'huggies', 'hanes', 'ikea', 'toyota',
  'honda', 'chevrolet', 'tesla', 'castrol', 'pennzoil', 'valvoline', 'sherwin-williams', 'behr', 'rust-oleum',
  'sharpie', 'bic', 'scotch', 'post-it', 'elmers', "elmer's", 'tropicana', 'minute maid', 'ocean spray', 
  'nescafe', 'folgers', 'budweiser', 'corona', 'heineken', 'guinness', 'jack daniels', 'smirnoff',
  'brita', 'purell', 'neutrogena', 'olay', 'pantene', 'head & shoulders', 'garnier', 'oral-b', 'nivea', 'vaseline',
];
const BRAND_RE = new RegExp(
  '(?<![\\p{L}\\p{N}])(?:' +
    [...new Set(BRANDS)]
      .sort((a, b) => b.length - a.length)
      .map((b) => b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "['\u2019]"))
      .join('|') +
    ")(?:['\u2019]s)?(?![\\p{L}\\p{N}])",
  'giu',
);

// Phrases the photo cannot support: resin numbers, deposit status, cleanliness.
const PHRASES: RegExp[] = [
  /#\s*\d+/g,
  /\b(?:resin|plastic|recycling)\s*(?:code|number|no\.?|#)?\s*[1-7]\b/gi,
  /\b(?:type|number|no\.?|code|grade)\s*[1-7]\b/gi,
  /\b(?:pete?|hdpe|ldpe|lldpe|pvc|pp|ps|pet)\b/gi,
  /\b(?:crv|hi-?5|bottle bill|deposit|refundable|redeemable|returnable|refund)\b/gi,
  /\b(?:clean|cleaned|dirty|empty|emptied|rinsed|washed|unwashed|soiled|food-soiled|greasy|oily|stained|dried|contaminated|full|sticky|moldy)\b/gi,
  /\b(?:recyclable|non-recyclable|nonrecyclable|compostable|biodegradable|reusable|disposable|hazardous|toxic)\b/gi,
  /\b(?:brand|branded|brand-name|model|logo|labeled|labelled|series|edition)\b/gi,
];

// A clause that talks about a bin, a verdict or disposal is dropped whole.
const VERDICT_CLAUSE =
  /\b(?:recycl\w*|compost\w*|bins?|trash|garbage|landfill|dispos\w*|drop[- ]?off|should|must|goes|go in|goes in|put in|throw\w*|acceptable|accepted|allowed|prohibited|ok to|okay to|can be|cannot|can't|do not|don't|please|curbside|cart)\b/i;

const UNITS = new Set([
  'oz', 'ounce', 'ounces', 'fl', 'ml', 'l', 'liter', 'liters', 'litre', 'litres', 'gal', 'gallon', 'gallons', 'lb', 'lbs',
  'pound', 'pounds', 'g', 'gram', 'grams', 'kg', 'inch', 'inches', 'in', 'ft', 'foot', 'feet', 'cm', 'mm', 'pack', 'pk',
  'count', 'ct', 'pc', 'pcs', 'piece', 'pieces',
]);
const STOP = new Set(['a', 'an', 'the', 'of', 'with', 'and', 'or', 'for', 'in', 'on', 'from', 'by', 'to', 'some', 'one', 'this', 'that', 'is', 'it', 'its']);

function edgeTrim(t: string): string {
  return t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

export function sanitizeLabel(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  let s = raw.replace(/[\u00ae\u2122\u00a9]/g, ' ').normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ');
  const beforeBrands = s;
  s = s.replace(BRAND_RE, ' ');
  const brandRemoved = s !== beforeBrands;
  for (const re of PHRASES) s = s.replace(re, ' ');
  // Clause filter.
  const clauses = s.split(/[,;.:()[\]/|!?\u2013\u2014]| - /).filter((c) => c.trim() && !VERDICT_CLAUSE.test(c));
  s = clauses.join(' ');
  const words = s.split(/\s+/).map(edgeTrim).filter((t) => t.length > 1 && /^\p{L}/u.test(t));
  // Title Case labels ("Glass Jar") are not treated as proper nouns.
  const titleCase = words.length > 0 && words.every((t) => /^\p{Lu}/u.test(t));
  const kept: string[] = [];
  let prevNumeric = false;
  let index = 0;
  for (const tokenRaw of s.split(/\s+/)) {
    const token = edgeTrim(tokenRaw);
    if (!token) continue;
    const lower = token.toLowerCase();
    const hasDigit = /\p{N}/u.test(token);
    if (hasDigit) { prevNumeric = true; continue; }
    if (prevNumeric && UNITS.has(lower)) { prevNumeric = false; continue; }
    prevNumeric = false;
    if (/[a-z][A-Z]/.test(token)) continue; // camel case: iPhone, eBook style product names
    if (!titleCase && (index > 0 || brandRemoved) && /^\p{Lu}\p{Ll}+$/u.test(token)) continue; // Capitalized word mid-label: likely a proper noun
    kept.push(lower);
    index++;
  }
  while (kept.length && STOP.has(kept[0])) kept.shift();
  while (kept.length && STOP.has(kept[kept.length - 1])) kept.pop();
  let out = kept.join(' ').replace(/\s+/g, ' ').trim();
  if (out.length > MAX_LABEL) out = out.slice(0, MAX_LABEL).replace(/\s+\S*$/, '').trim();
  if (!/\p{L}/u.test(out) || out.length < 2) return '';
  return out;
}

// Reduce whatever the provider sent to the schema. Extra keys (stream, verdict, advice) are dropped.
export function reduceReply(value: unknown): Reduced {
  const unclear: Reduced = { status: 'unclear', label: null, candidates: [], emptiedByCleaning: false };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return unclear;
  const v = value as Record<string, unknown>;
  if (v.status === 'identified') {
    const rawLabel = typeof v.label === 'string' ? v.label.trim() : '';
    const label = sanitizeLabel(rawLabel);
    if (!label) return { ...unclear, emptiedByCleaning: rawLabel.length > 0 };
    return { status: 'identified', label, candidates: [], emptiedByCleaning: false };
  }
  if (v.status === 'multiple') {
    const list = Array.isArray(v.candidates) ? v.candidates : [];
    const seen = new Set<string>();
    const candidates: string[] = [];
    for (const item of list) {
      const c = sanitizeLabel(item);
      if (c && !seen.has(c)) { seen.add(c); candidates.push(c); }
      if (candidates.length === MAX_CANDIDATES) break;
    }
    return { status: 'multiple', label: null, candidates, emptiedByCleaning: false };
  }
  return unclear;
}
