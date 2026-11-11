# AmbatuCode migration notes

Running log for the Neuravity -> AmbatuCode rename and the replacement of the
Gemini/ffmpeg speech-to-text path with a classical, local keyword-recognition
pipeline (Google Speech Commands v2: 35 keywords + `silence` + `unknown` = 37
classes).

Hard constraints for the speech path: **no deep-learning models, no external or
cloud APIs.**

## Branches

| Item            | Value                                                                           |
| --------------- | ------------------------------------------------------------------------------- |
| Base branch     | `main`                                                                          |
| Working branch  | `ambatucode-migration`                                                          |
| Snapshot commit | `WIP: snapshot before AmbatuCode migration`, made on `main` as Phase 0 requires |

The tree on `main` was dirty when the run started (`models.py` modified;
`README.md`, `backend-go/`, `backend-python/` and `frontend/` untracked), so it was
snapshotted first. Git-ignored files (`.env`, `venv/`, `node_modules/`, `.next/`)
were not included. All migration work is on `ambatucode-migration`. Nothing was
pushed.

## Baseline (before any migration change)

Recorded so that pre-existing failures are not mistaken for regressions.

| Check                                          | Baseline result                                                                                                                                                                                                                                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `go build ./...` / `go vet ./...` (backend-go) | clean                                                                                                                                                                                                                                                                                       |
| `npm run type-check` (frontend)                | **9 pre-existing errors** in `src/components/modals/GitHubModal.tsx` (6), `src/hooks/useFileOperations.ts` (1), `src/store/auth.ts` (2). Missing exports/modules (`@/services/memory`, `fetchUserRepos`, `importRepository`) and wrong arity calls. Unrelated to this migration; not fixed. |
| `npx eslint` on `ChatPanel.tsx` + `page.tsx`   | 9 errors / 23 warnings, almost all `no-explicit-any` and unused vars. Pre-existing.                                                                                                                                                                                                         |
| Python tests                                   | none existed                                                                                                                                                                                                                                                                                |
| `backend-python/requirements.txt`              | **git-ignored** (`*.txt` in `backend-python/.gitignore`), so it was never tracked                                                                                                                                                                                                           |

## Phase 1: rename Neuravity -> AmbatuCode

Mechanical replacement over all tracked text files:
`Neuravity -> AmbatuCode`, `neuravity -> ambatucode`, `NEURAVITY -> AMBATUCODE`.

Covered: README, Go module path (`neuravity-engine` -> `ambatucode-engine`) and
its import in `backend-go/main.go`, FastAPI title/messages, agent/system prompts,
frontend page title/metadata, translations (en/id/es/ja), export filenames,
Monaco theme names (`ambatucode-dark` / `ambatucode-light`, defined in
`monacoConfig.ts` and consumed in `page.tsx`), and browser storage keys.

There were no tracked files or folders with the old name, so no `git mv` was
needed. No Dockerfile / docker-compose / CI / `.env.example` / `pyproject` file
contains the old name (`.env.example` and CI config do not exist in the repo).

### Assumptions and things to know

1. **Browser storage keys were renamed** (`neuravity-*` -> `ambatucode-*`, e.g.
   `neuravity-storage`, `neuravity-editor-settings`, `neuravity_chat_history`,
   IndexedDB `neuravity-memory`). This is what the rename spec asks for ("config
   keys"), but it means data a browser saved under the old keys is **orphaned**
   (settings, chat history, long-term memory). No migration shim was added.
2. **`backend-go/handlers/terminal.go` hard-coded**
   `D:\Documents\Code\Hackathon\Neuravity` as the terminal start directory. That
   is a machine-specific path to a folder that is _not_ renamed on disk, so a
   literal rename would just point at a non-existent folder. It now reads
   `AMBATUCODE_WORKDIR` and falls back to the process working directory (the old
   code already fell back to `os.Getwd()` when the folder was missing). Set
   `AMBATUCODE_WORKDIR` if you want the old behaviour back.
3. The diff for `backend-go/handlers/terminal.go` also contains a few
   whitespace-only `gofmt`-style changes (trailing tabs removed, spacing around
   `+`) that I did not write by hand; they look like a formatter run on save.
   They are behaviour-neutral.
4. **`frontend/.env` (git-ignored, deliberately not modified)** still contains
   `NEXT_PUBLIC_APP_NAME=Neuravity`. Nothing in `frontend/src` reads that
   variable. Update it by hand if you like. It was not touched because it is a
   local secrets file.
5. **`frontend/public/logo.png` is a binary and was not changed.** The artwork
   contains a stylised "N" (for Neuravity). The file name is brand-neutral, so
   replacing the image in place needs no code change.
6. "No `neuravity` remains" was verified with
   `git grep -n -i -I "neuravity"` (tracked files, plus `--untracked`). Ignored
   local files (`frontend/.env`, `node_modules`, `.next`, `venv`) are excluded by
   design.

## Phase 2: fix dead `enhance-transcript` route

`backend-python/routers/voice.py`: `enhance_voice_transcript` had no decorator, so
the endpoint did not exist (the frontend got a 404/405). Added
`@router.post("/enhance-transcript")`. With the router prefix this is
`POST /api/voice/enhance-transcript`, which is exactly the URL
`ChatPanel.tsx` calls (`http://127.0.0.1:8000/api/voice/enhance-transcript`).

Tests: `backend-python/tests/test_voice_routes.py` (route registered, request is
forwarded to Gemini with the right arguments, graceful fallback when Gemini
fails). Gemini is stubbed, no network. I removed the decorator temporarily to
confirm all three tests fail without the fix, then restored it.

### Test tooling added
- `backend-python/pytest.ini` (`pythonpath = .`, `testpaths = tests`).
- `backend-python/requirements-dev.txt` (`pytest`, `httpx` for FastAPI's `TestClient`).
- `pytest` was installed into the local (git-ignored) `venv/` to run the tests.
- `backend-python/.gitignore` ignored every `*.txt`, which silently hid
  `requirements.txt`. I added `!requirements.txt` / `!requirements-dev.txt`
  exceptions so dependency changes are tracked from now on. This is the only
  `.gitignore` change. `requirements.txt` is therefore newly tracked in this
  commit, in its pre-migration state; Phase 3 trims it.
