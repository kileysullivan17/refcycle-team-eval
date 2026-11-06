// Display labels and card colors for the engine's streams (CONTRACTS section 8).
// This maps a stream the engine returned to a label; it never decides a stream.

export const STREAM_LABELS = {
  recycle_bin: 'Recycling',
  compost_bin: 'Compost',
  garbage: 'Garbage',
  drop_off_special: 'Special drop-off',
  deposit_return: 'Deposit return',
};

export function isStream(value) {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(STREAM_LABELS, value);
}

/** Item page state for an `answer`: blue flag, yellow card or red card (X-10). */
export function cardStateFor(stream) {
  if (stream === 'recycle_bin' || stream === 'compost_bin' || stream === 'deposit_return') return 'card-blue';
  if (stream === 'garbage') return 'card-yellow';
  if (stream === 'drop_off_special') return 'card-red';
  return null;
}
