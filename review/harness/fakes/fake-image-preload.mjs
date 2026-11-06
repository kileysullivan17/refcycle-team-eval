// Fake image provider for the harness dry run. Loaded into the app process with `node --import`, before the
// app's own code, so the build is not changed. It answers only the two provider endpoints the contract names
// (Anthropic messages, OpenAI chat completions) and passes every other fetch through untouched.
//
// The harness writes the id of the photo it is about to upload to FAKE_PHOTO_CONTROL; the fake reads it
// to choose the label. It never looks at the image, so the photo's bytes go nowhere.
import { readFileSync } from 'node:fs';
import { labelFor } from './fixtures.mjs';

const mode = process.env.FAKE_IMAGE_MODE === 'broken' ? 'broken' : 'key';
const control = process.env.FAKE_PHOTO_CONTROL;
const realFetch = globalThis.fetch;

globalThis.fetch = async function fakeAwareFetch(input, init) {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const anthropic = url.startsWith('https://api.anthropic.com/');
  const openai = url.startsWith('https://api.openai.com/');
  if (!anthropic && !openai) return realFetch(input, init);
  let photo = '';
  try {
    photo = readFileSync(control, 'utf8').trim();
  } catch {
    /* no control file: unclear */
  }
  const value = JSON.stringify(labelFor(mode, photo));
  const model = `fake-image-${mode}`;
  const body = anthropic
    ? { id: 'fake', type: 'message', model, content: [{ type: 'text', text: value }] }
    : { id: 'fake', model, choices: [{ message: { role: 'assistant', content: value } }] };
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
console.log(`Fake image provider (${mode}) installed; control file ${control || '(none)'}`);
