# Post-merge decisions (K1 to K5)

Decided by Kiley Sullivan, 2026-11-05. All five recommendations accepted. The live end-to-end check runs on Kiley's Mac with the key already in his local Build B folder; the key is not copied anywhere else.

- K1 (CR-locator-001). Set `url: null` on src-05, src-06 and src-07 in `engine/rules/austin_tx.yaml`. No engine answer changes: those sources back only the also-acceptable route on atx-metal-020. Business names stay private. The same fix is owed to the public packs in kileysullivan17/refcycle-eval (follow-up, not part of this build).
- K2. Replace "Is this a <label>?" with "We think this is: <label>. Is that right?", same Yes and Edit buttons.
- K3. Add the shell's `--type-<style>-size` and `--type-<style>-weight` names to CONTRACTS 11 (v1.2); the locator and camera scan switch to them before the scored run.
- K4. Spacing may use multiples of 4px (half of `--space-unit`), always through the token. Closes NB-1 to NB-3 with no code change.
- K5 (CR-locator-002). Approve `applies_to` on `RuleWhere` and `official_source` in the `/api/sites` response, as merged.
