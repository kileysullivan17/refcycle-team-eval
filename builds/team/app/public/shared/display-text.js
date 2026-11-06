// displayText: the one display-time swap (CONTRACTS section 9, X-2, X-5). Data is never altered.
//  - Every spelling of the county name becomes "Hawaiʻi County", outside quoted source lines.
//  - "Big Island Biodiesel" becomes "a local biodiesel company", outside quoted source lines.
//  - Text between “ and ” is a quoted source line and is left exactly as written. A “ that is never
//    closed leaves the rest of the string as written.
// Nothing else changes. Each replacement kind that fired is reported to the swap logger.

const COUNTY = /County of Hawai[ʻ‘’'`]?i/g;
const COUNTY_TO = 'Hawaiʻi County';
const BUSINESS = /Big Island Biodiesel/g;
const BUSINESS_TO = 'a local biodiesel company';

let logger = null;

/** The shell sets a function that receives { surface, from, to, count }. Logging never blocks display. */
export function setSwapLogger(fn) {
  logger = typeof fn === 'function' ? fn : null;
}

function swapSegment(segment, found) {
  const apply = (text, pattern, to) =>
    text.replace(pattern, (match) => {
      const key = match + '\u0000' + to;
      found.set(key, { from: match, to, count: (found.get(key)?.count || 0) + 1 });
      return to;
    });
  return apply(apply(segment, COUNTY, COUNTY_TO), BUSINESS, BUSINESS_TO);
}

export function displayText(text, surface) {
  if (typeof text !== 'string') return '';
  if (text === '') return text;
  const found = new Map();
  let out = '';
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf('“', i);
    if (open === -1) {
      out += swapSegment(text.slice(i), found);
      break;
    }
    out += swapSegment(text.slice(i, open), found);
    const close = text.indexOf('”', open + 1);
    if (close === -1) {
      out += text.slice(open);
      break;
    }
    out += text.slice(open, close + 1);
    i = close + 1;
  }
  if (found.size && logger) {
    for (const entry of found.values()) {
      try {
        logger({ surface: String(surface || 'unknown'), from: entry.from, to: entry.to, count: entry.count });
      } catch {
        /* logging never blocks display */
      }
    }
  }
  return out;
}
