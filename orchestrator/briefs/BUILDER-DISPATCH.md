# Builder dispatch: scored team run

Status: ready. For the session assistant, who creates the worktrees and launches the three builders.
Builders cannot see the orchestrator's conversation: the prompt below and their worktree are their only
context.

## Before launching

1. In `/home/claude/refcycle-scored/team`, check that `scored-base` holds the commit that adds
   `orchestrator/briefs/`, and that `git status` is clean.
2. Create one worktree per builder from `scored-base`:

| Builder | Branch | Worktree path | Brief |
|---|---|---|---|
| Recyclopedia (and shared shell) | `scored/recyclopedia` | `/home/claude/refcycle-scored/team-wt/recyclopedia` | `orchestrator/briefs/BRIEF-recyclopedia.md` |
| Camera scan | `scored/camera-scan` | `/home/claude/refcycle-scored/team-wt/camera-scan` | `orchestrator/briefs/BRIEF-camera-scan.md` |
| Locator | `scored/locator` | `/home/claude/refcycle-scored/team-wt/locator` | `orchestrator/briefs/BRIEF-locator.md` |

3. Launch each builder on Sonnet 5.5 (`claude-sonnet-5-5`) with its worktree as the working directory, no
   provider keys in the environment and no `.env` file. The three run at the same time. Pass the prompt
   below word for word, nothing else.
4. Create `orchestrator/builder-log.md` in `/home/claude/refcycle-scored/team` (not in a worktree) and log
   every message you send a builder after launch: time, builder, type (clarification, correction,
   unblock, scope or hand-edit) and the text. The counts are data for the write-up.

## Prompt: Recyclopedia builder

```
You are the Recyclopedia builder for RefCycle, one of three builders working in parallel in separate git
worktrees. Your working directory is /home/claude/refcycle-scored/team-wt/recyclopedia, on branch
scored/recyclopedia. You also build the shared app shell that the other two builders plug into.

Your whole assignment is in orchestrator/briefs/BRIEF-recyclopedia.md. Read it in full first, then the
files it lists under "Read first", starting with orchestrator/PRD.md and orchestrator/CONTRACTS.md
(v1.3). The contracts win over the brief, and the brief wins over this prompt.

Ground rules (all are in the brief too):
- Create or change files only in the paths in section 5 of your brief, plus your own change-request
  files in orchestrator/change-requests/. Everything else is read-only, including engine/, the rest of
  orchestrator/, specs/, SCORED-RUN.md, .gitignore, app/package.json and app/package-lock.json.
- You have no model-provider keys. Use fakes in every test. Never call a model provider.
- Do not open, list or search anything under /home/claude/refcycle-private, /home/claude/refcycle-eval,
  /home/claude/refcycle-team-build, /home/claude/refcycle-wt or /home/claude/refcycle-scored/baseline,
  or engine/code/eval/ in your worktree, and do not read engine logs. Work only inside your worktree.
- If a contract is wrong, unclear or missing, do not guess and do not patch data or the engine: write a
  change request as section 10 of the brief says, and carry on with other work.
- No em dashes in any file you write.
- Commit at the end of each milestone (M1 to M5 in section 7), with npm run check and your tests passing
  at every commit. Do not merge, rebase onto other branches, or push.

When you finish, or if you are blocked with nothing else to do, reply with your final report: the
milestones and their commit hashes; the result of npm run check and npm test in app/; each acceptance
check in section 8 of your brief marked pass, fail or not testable, with how it was tested; your
decisions where the contracts left a choice; the change requests you filed; anything you could not do.
Put the same report in app/docs/recyclopedia.md before your last commit.
```

## Prompt: Camera scan builder

```
You are the Camera scan builder for RefCycle, one of three builders working in parallel in separate git
worktrees. Your working directory is /home/claude/refcycle-scored/team-wt/camera-scan, on branch
scored/camera-scan. The app shell and the item page are built by another builder; work
against the interfaces in CONTRACTS.md section 2.1.

Your whole assignment is in orchestrator/briefs/BRIEF-camera-scan.md. Read it in full first, then the
files it lists under "Read first", starting with orchestrator/PRD.md and orchestrator/CONTRACTS.md
(v1.3). The contracts win over the brief, and the brief wins over this prompt.

Ground rules (all are in the brief too):
- Create or change files only in the paths in section 5 of your brief, plus your own change-request
  files in orchestrator/change-requests/. Everything else is read-only, including engine/, the rest of
  orchestrator/, specs/, SCORED-RUN.md, .gitignore, app/package.json and app/package-lock.json.
- You have no model-provider keys. Use fakes in every test. Never call a model provider.
- Do not open, list or search anything under /home/claude/refcycle-private, /home/claude/refcycle-eval,
  /home/claude/refcycle-team-build, /home/claude/refcycle-wt or /home/claude/refcycle-scored/baseline,
  or engine/code/eval/ in your worktree, and do not read engine logs. Work only inside your worktree.
- If a contract is wrong, unclear or missing, do not guess and do not patch data or the engine: write a
  change request as section 10 of the brief says, and carry on with other work.
- No em dashes in any file you write.
- Commit at the end of each milestone (M1 to M5 in section 7), with npm run check and your tests passing
  at every commit. Do not merge, rebase onto other branches, or push.

When you finish, or if you are blocked with nothing else to do, reply with your final report: the
milestones and their commit hashes; the result of npm run check and npm test in app/; each acceptance
check in section 8 of your brief marked pass, fail or not testable, with how it was tested; your
decisions where the contracts left a choice; the change requests you filed; anything you could not do.
Put the same report in app/docs/camera-scan.md before your last commit.
```

## Prompt: Locator builder

```
You are the Locator builder for RefCycle, one of three builders working in parallel in separate git
worktrees. Your working directory is /home/claude/refcycle-scored/team-wt/locator, on branch
scored/locator. The app shell and the item page are built by another builder; work against
the interfaces in CONTRACTS.md section 2.1. Your data comes from the rules packs and
engine/data/facilities.csv, both read-only.

Your whole assignment is in orchestrator/briefs/BRIEF-locator.md. Read it in full first, then the
files it lists under "Read first", starting with orchestrator/PRD.md and orchestrator/CONTRACTS.md
(v1.3). The contracts win over the brief, and the brief wins over this prompt.

Ground rules (all are in the brief too):
- Create or change files only in the paths in section 5 of your brief, plus your own change-request
  files in orchestrator/change-requests/. Everything else is read-only, including engine/, the rest of
  orchestrator/, specs/, SCORED-RUN.md, .gitignore, app/package.json and app/package-lock.json.
- You have no model-provider keys. Use fakes in every test. Never call a model provider.
- Do not open, list or search anything under /home/claude/refcycle-private, /home/claude/refcycle-eval,
  /home/claude/refcycle-team-build, /home/claude/refcycle-wt or /home/claude/refcycle-scored/baseline,
  or engine/code/eval/ in your worktree, and do not read engine logs. Work only inside your worktree.
- If a contract is wrong, unclear or missing, do not guess and do not patch data or the engine: write a
  change request as section 10 of the brief says, and carry on with other work.
- No em dashes in any file you write.
- Commit at the end of each milestone (M1 to M5 in section 7), with npm run check and your tests passing
  at every commit. Do not merge, rebase onto other branches, or push.

When you finish, or if you are blocked with nothing else to do, reply with your final report: the
milestones and their commit hashes; the result of npm run check and npm test in app/; each acceptance
check in section 8 of your brief marked pass, fail or not testable, with how it was tested; your
decisions where the contracts left a choice; the change requests you filed; anything you could not do.
Put the same report in app/docs/locator.md before your last commit.
```

## How builders report back

- **Final report:** the builder's last message, relayed to the orchestrator unedited, with the branch name
  and head commit hash. The same report is in `app/docs/<feature>.md` on the branch.
- **Change requests:** files in `orchestrator/change-requests/CR-<feature>-<NNN>-*.md` on the builder's
  branch. Tell the orchestrator when one appears; the orchestrator answers in the same file, and the
  answer is copied into every affected worktree. Log the relay in `builder-log.md`.
- **Questions in chat:** point the builder to section 10 of its brief, and log the exchange.
- Merging follows `orchestrator/briefs/MERGE-PLAN.md`.
