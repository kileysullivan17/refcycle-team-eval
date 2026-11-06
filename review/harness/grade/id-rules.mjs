// Camera scan identification: is the label a fair generic name for the key's identification_expected?
// Written by the reviewer on 2026-11-05 BEFORE any scored run, from the key's item_shown and
// identification_expected columns only. The verdict is automatic and provisional: identification-review.csv
// lists every label so a person can confirm or override it (see grade.mjs --id-review).
//
// all: every pattern must match. any: at least one must match (when given). not: none may match.

export const ID_RULES = {
  ph01: { all: [/bottle/i], any: [/plastic|pet\b|water|beverage|drink/i] },
  ph02: { all: [/bottle/i], any: [/plastic|pet\b|water|beverage|drink/i] },
  ph03: { any: [/jug|bottle|container/i], all: [/detergent|laundry|hdpe|plastic/i] },
  ph04: { any: [/jug|bottle|container/i], all: [/detergent|laundry|hdpe|plastic/i] },
  ph05: { all: [/bag/i], any: [/plastic|grocery|shopping|film|carrier/i], not: [/paper/i] },
  ph06: { all: [/bag/i], any: [/plastic|grocery|shopping|film|carrier/i], not: [/paper/i] },
  ph07: { any: [/tub|cup|container/i], all: [/yogurt|plastic|\bpp\b|polypropylene|#?5\b/i] },
  ph08: { any: [/tub|cup|container/i], all: [/yogurt|plastic|\bpp\b|polypropylene|#?5\b/i] },
  ph09: { all: [/\bcan\b/i], any: [/alumin|soda|beverage|drink|metal/i], not: [/paint|spray/i] },
  ph10: { all: [/\bcan\b/i], any: [/alumin|soda|beverage|drink|metal/i], not: [/paint|spray/i] },
  ph11: { all: [/jar/i] },
  ph12: { all: [/jar/i] },
  ph13: { any: [/cardboard|corrugated|shipping box|moving box|brown box/i] },
  ph14: { all: [/pizza/i, /box/i] },
  ph15: { all: [/pizza/i, /box/i] },
  ph16: { any: [/microwave/i, /appliance/i] },
  ph17: { any: [/microwave/i, /appliance/i] },
  ph18: { all: [/batter/i] },
  ph19: { all: [/batter/i] },
  ph20: { all: [/\btires?\b|\btyres?\b/i] },
  ph21: { all: [/paint/i] },
  // ph22 key change 2026-11-05, after results (Kiley): two items, so a follow-up question is also correct.
  ph22: { any: [/banana|apple|fruit|food scrap|food waste|peel|core|compost/i], followupOk: true },
  ph23: { all: [/coffee/i], any: [/pod|capsule|cup/i] },
  ph24: { followup: true },
  ph25: { any: [/cereal|paperboard|boxboard|chipboard/i] },
  ph26: { all: [/carton/i] },
  ph27: { any: [/clamshell|container|berry|produce/i], not: [/bag/i] },
  ph28: { all: [/bottle/i], any: [/glass|wine/i] },
  ph29: { any: [/bubble|film|wrap|packaging|air pillow/i] },
  ph30: { followup: true },
  ph31: { any: [/propane|butane|gas|cylinder|canister|fuel/i] },
  ph32: { any: [/fluorescent|tube light|light tube|lamp|bulb/i] },
  ph33: { any: [/foam|styrofoam|polystyrene|\beps\b/i] },
  ph34: { all: [/bottle/i], any: [/plastic|pet\b|clear/i] },
  ph35: { all: [/\bcan\b/i], any: [/tin|steel|soup|metal|food/i], not: [/alumin|soda|beverage|paint/i] },
  ph36: { all: [/straw/i] },
};

// Brand and model names a generated photo might draw out of a model. "Styrofoam", "bubble wrap" and
// "mason jar" are left out on purpose: the key and the packs use them as generic names.
export const BRANDS = /\b(coca[- ]?cola|coke|pepsi|sprite|fanta|dasani|aquafina|evian|fiji|poland spring|arrowhead|tide|gain|persil|all free|clorox|chobani|dannon|yoplait|fage|duracell|energizer|rayovac|keurig|k-?cups?|nespresso|coleman|igloo|yeti|michelin|goodyear|bridgestone|firestone|pirelli|sherwin|behr|rust-?oleum|benjamin moore|valspar|philips|sylvania|panasonic|samsung|whirlpool|frigidaire|hamilton beach|kellogg|cheerios|general mills|budweiser|bud light|coors|miller|corona|heineken|starbucks|folgers|ziploc|glad|hefty|amazon|walmart|target|campbell'?s?|heinz|kirkland|horizon|lactaid)\b/i;

/** Returns { verdict: 'correct'|'wrong'|'review', reason }. */
export function judgeIdentification(photoId, status, label, candidates = []) {
  const rule = ID_RULES[photoId];
  if (!rule) return { verdict: 'review', reason: 'no rule for this photo' };
  if (rule.followup) {
    if (status === 'multiple' || status === 'unclear') return { verdict: 'correct', reason: `asked a follow-up (${status})` };
    if (photoId === 'ph24' && status === 'identified') {
      const can = /\bcan\b/i.test(label || '');
      const bottle = /bottle/i.test(label || '');
      if (can && bottle) return { verdict: 'wrong', reason: 'merged two items into one label' };
      if (can || bottle) return { verdict: 'review', reason: 'named one of the two items (the key note allows answering the first item)' };
    }
    return { verdict: 'wrong', reason: `identified "${label}" where a follow-up question was expected` };
  }
  if (rule.followupOk && (status === 'multiple' || status === 'unclear')) return { verdict: 'correct', reason: `asked a follow-up (${status}), allowed for this photo` };
  if (status !== 'identified') return { verdict: 'wrong', reason: `no identification (${status ?? 'none'}); asked instead` };
  const text = String(label || '');
  if (BRANDS.test(text)) return { verdict: 'wrong', reason: `brand or model name in label: ${text.match(BRANDS)[0]}` };
  if ((rule.all || []).some((re) => !re.test(text))) return { verdict: 'wrong', reason: 'label does not name the item' };
  if (rule.any && !rule.any.some((re) => re.test(text))) return { verdict: 'wrong', reason: 'label does not name the item' };
  if ((rule.not || []).some((re) => re.test(text))) return { verdict: 'wrong', reason: 'label names a different item' };
  return { verdict: 'correct', reason: 'generic name matches' };
}
