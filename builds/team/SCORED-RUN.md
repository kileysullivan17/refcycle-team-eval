# Scored run inputs

Base for both scored runs (solo baseline and agent team), branched from main at 617eda5 on 2026-11-05.

Kept: the source specs (specs/), the pinned engine (engine/code, Build B), the public rules packs (engine/rules, with the K1 fix), the facility list with Kiley's coordinates (engine/data), the approved PRD (orchestrator/PRD.md), contracts v1.3 (orchestrator/CONTRACTS.md), the decision records, and the app configuration (app/package.json, app/package-lock.json, app/tsconfig.json, app/.env.example).

Removed: every line of practice-run app code and tests, the practice briefs, merge log, change requests and builder log. Both runs start from these same inputs. Contracts v1.3 already includes the fixes the practice run found; the write-up says so.
