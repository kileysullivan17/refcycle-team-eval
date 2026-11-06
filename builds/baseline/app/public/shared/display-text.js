// The one display-time text swap (CONTRACTS 9; X-2, G12, G13). Data is never altered, only what is shown.

const COUNTY = /County of Hawai[ʻ‘’'`]?i/g;
const COUNTY_TO = 'Hawaiʻi County';
const BUSINESS = /Big Island Biodiesel/g;
const BUSINESS_TO = 'a local biodiesel company';
// Quoted source lines (between curly quotes) are left as written.
const QUOTED = /(“[^”]*”)/;

let sink = null;

/** The shell installs a sink: ({ surface, from, to, count }) => void. It adds the place and sends the log. */
export function setSwapSink(fn) {
  sink = typeof fn === 'function' ? fn : null;
}

function swapPlain(part, found) {
  let out = part.replace(COUNTY, (m) => {
    found.set(m + '\u0000' + COUNTY_TO, (found.get(m + '\u0000' + COUNTY_TO) || 0) + 1);
    return COUNTY_TO;
  });
  out = out.replace(BUSINESS, (m) => {
    found.set(m + '\u0000' + BUSINESS_TO, (found.get(m + '\u0000' + BUSINESS_TO) || 0) + 1);
    return BUSINESS_TO;
  });
  return out;
}

/** Pure form: returns the swapped text and the list of replacements made. */
export function swapText(text) {
  const s = String(text ?? '');
  const found = new Map();
  const out = s
    .split(QUOTED)
    .map((part, i) => (i % 2 === 1 ? part : swapPlain(part, found)))
    .join('');
  const swaps = [...found].map(([key, count]) => {
    const [from, to] = key.split('\u0000');
    return { from, to, count };
  });
  return { text: out, swaps };
}

/** displayText(text, surface): swaps, and reports each replacement through the sink. Logging never blocks display. */
export function displayText(text, surface) {
  const { text: out, swaps } = swapText(text);
  if (sink && swaps.length) {
    for (const s of swaps) {
      try {
        sink({ surface: String(surface || 'unknown'), ...s });
      } catch {
        /* logging failures never block display */
      }
    }
  }
  return out;
}
