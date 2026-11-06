// Fixture answers for the harness dry run. PRACTICE CASES ONLY: these are the practice rows of the frozen keys,
// written as the model selections the pinned engine expects. No test or held_out case appears here.
//
// Mode "key": every practice case gets the key's own answer, so a correct harness and grader score 100%.
// Mode "broken": the same, except for the deliberate faults listed in BROKEN, so the grader must report
// exactly those and nothing else.

const sel = (rule_id, condition_index = null) => ({ rule_id, condition_index });
const answer = (item, rule, idx = null) => ({ behavior: 'answer', item_interpreted: item, selections: [sel(rule, idx)], clarifying_question: null });
const abstain = (item = null) => ({ behavior: 'abstain', item_interpreted: item, selections: [], clarifying_question: null });
const clarify = (item, q) => ({ behavior: 'clarify', item_interpreted: item, selections: [], clarifying_question: q });

/** [place, query as the UI sends it] -> selection. Queries are matched lower-cased and trimmed. */
export const KEY_ANSWERS = {
  seattle_wa: {
    'pet bottle': answer('PET plastic bottle', 'sea-plastic-009'),
    'cottage cheese container': answer('cottage cheese container', 'sea-plastic-010'),
    'corrugated cardboard': answer('corrugated cardboard', 'sea-paper-002'),
    pesticide: answer('pesticide', 'sea-special-022'),
    'household chemicals, pesticides and poisons': answer('household chemicals, pesticides and poisons', 'sea-special-022'),
    'fluorescent tube': answer('fluorescent tube', 'sea-special-018'),
    pesticides: answer('pesticides', 'sea-special-022'),
    'gable-top milk carton': answer('milk carton', 'sea-paper-003'),
  },
  austin_tx: {
    'hdpe jug': answer('HDPE plastic jug', 'atx-plastic-004'),
    'beer can': answer('beer can', 'atx-metal-020'),
    'old laptop': answer('laptop', 'atx-special-018'),
    'styrofoam cooler': answer('Styrofoam cooler', 'atx-foam-009'),
    'battery-operated toy': answer('battery-operated toy', 'atx-special-010'),
    'battery-operated toys': answer('battery-operated toys', 'atx-special-010'),
    'plastic berry clamshell': answer('plastic berry clamshell', 'atx-plastic-005'),
    'bubble wrap': answer('bubble wrap', 'atx-plastic-008'),
  },
  hawaii_county_hi: {
    'bread bag': answer('plastic bread bag', 'hc-plastic-006', 3),
    'wine bottle': answer('wine bottle', 'hc-glass-004'),
    'rechargeable batteries': answer('rechargeable batteries', 'hc-hhw-010'),
    'empty propane tank': answer('empty propane tank', 'hc-hhw-018'),
    'hi-5 soda bottle': answer('HI-5 soda bottle', 'hc-deposit-005'),
    'paperboard cereal box': answer('cereal box', 'hc-paper-003'),
    'green glass wine bottle': answer('glass wine bottle', 'hc-glass-004'),
  },
};

/** Deliberate faults for the broken dry run, and what the grader must say about each. */
export const BROKEN = {
  austin_tx: {
    'hdpe jug': { value: abstain('HDPE jug'), expect: 'rp02-aus: over-abstention (abstained where the key expects recycle_bin)' },
    'old laptop': { value: 'INVALID', expect: 'rp08-aus: engine validation fails twice, engine abstains; over-abstention' },
    'plastic grocery bag': { value: answer('plastic grocery bag', 'atx-plastic-008'), expect: 'ph27: wrong item identified with no follow-up; routed drop_off_special, confident wrong' },
  },
  seattle_wa: {
    'cottage cheese container': { value: answer('cottage cheese container', 'sea-special-018'), expect: 'rp04-sea: confident wrong (drop_off_special, key recycle_bin); citation still valid' },
    pesticides: { value: answer('pesticides', 'sea-special-018'), expect: 'lc04-sea: right stream, wrong rule; locator lists no site where the key expects f-sea-03 and f-sea-04' },
  },
  hawaii_county_hi: {
    'wine bottle': { value: clarify('wine bottle', 'Does the bottle carry the HI-5 deposit label?'), expect: 'rp06-haw: wrong (asked where the key expects recycle_bin); not confident wrong' },
  },
};

/** Fake image provider labels, by practice photo id. */
export const KEY_LABELS = {
  ph25: { status: 'identified', label: 'paperboard cereal box', candidates: [] },
  ph26: { status: 'identified', label: 'gable-top milk carton', candidates: [] },
  ph27: { status: 'identified', label: 'plastic berry clamshell', candidates: [] },
  ph28: { status: 'identified', label: 'green glass wine bottle', candidates: [] },
  ph29: { status: 'identified', label: 'bubble wrap', candidates: [] },
  ph30: { status: 'unclear', label: null, candidates: [] },
};

export const BROKEN_LABELS = {
  ph27: { status: 'identified', label: 'plastic grocery bag', candidates: [], expect: 'ph27: wrong item identified, no follow-up' },
  ph30: { status: 'identified', label: 'small metal box', candidates: [], expect: 'ph30: a guess on a blurry photo, no follow-up; the engine abstains (route acceptable), identification wrong' },
};

export function selectionFor(mode, place, query) {
  const q = String(query).trim().toLowerCase();
  if (mode === 'broken' && BROKEN[place]?.[q]) return BROKEN[place][q].value;
  return KEY_ANSWERS[place]?.[q] ?? abstain();
}

export function labelFor(mode, photoId) {
  if (mode === 'broken' && BROKEN_LABELS[photoId]) {
    const { expect, ...rest } = BROKEN_LABELS[photoId];
    return rest;
  }
  return KEY_LABELS[photoId] ?? { status: 'unclear', label: null, candidates: [] };
}
