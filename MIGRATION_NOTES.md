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

## Phase 3: remove Gemini STT, add the classifier interface

### Removed
- `POST /api/voice/stt` (Gemini multimodal transcription) and
  `POST /api/voice/transcribe-audio` (a second, duplicate Gemini transcription
  endpoint that the task did not list but that called the same method).
- `GeminiService.transcribe_audio`.
- `_do_transcribe` and `recognizer = sr.Recognizer()` in `routers/voice.py`.
  Nothing called them, but they used `recognize_google()`, i.e. Google's cloud
  speech API, which breaks the "no external/cloud APIs" rule by itself.
- The `pydub`/`ffmpeg.exe` bootstrap block and the now-dead imports
  (`speech_recognition`, `io`, `os`, `asyncio`, `UploadFile`).
- Dependencies `SpeechRecognition`, `pydub` and `python-multipart` from
  `backend-python/requirements.txt` (`python-multipart` was only needed for the
  `UploadFile` endpoints). ffmpeg is no longer a prerequisite.

### Kept (Gemini usage that is not speech-to-text)
- `POST /api/voice/enhance-transcript` -> `GeminiService.enhance_voice_transcript`
  (text in, text out; fixed in Phase 2). The frontend stops calling it in Phase 7,
  but the route stays because the task said to keep transcript enhancement.
- `POST /api/voice/process` and `/process-stream` (`classify_intent`,
  `generate_code`, `modify_code`, `explain_code`): take a transcript *string*.
  They no longer have a speech source, so they are only reachable with typed text.
- `GeminiService.generate_embedding`, `chat_with_context`, `extract_insight`, and
  `services/agent_executor.py` (function-calling chat agent) plus
  `services/memory_service.py`: the AI chat/memory features.
- `google-generativeai` dependency and `GEMINI_API_KEY`.

These keep calling Gemini, a cloud API. The "no cloud APIs" constraint was applied
to the speech-recognition path only. The editor's chat agent still needs Gemini,
and the code runner still posts to the public Piston API (`backend-go/handlers/compiler.go`).
Say so if you want those removed as well.

### Added
- `backend-python/services/classifier.py`: `Classifier` `typing.Protocol`
  (`labels`, `feature_dim`, `predict(features) -> ClassifierOutput`), structural so a
  real model needs no inheritance, plus a docstring showing how to plug one in.
- `backend-python/models/classifier_schemas.py`: `ClassifierOutput` / `TopKEntry`
  pydantic models. **Placement note:** the task lists the output contract under
  Phase 5, but the interface's return type depends on it, so the pydantic models
  were introduced here. Phase 5 adds the Go mirror, the stub and the contract tests.
- Tests: `tests/test_stt_removed.py` (endpoints gone, no leftovers, deps gone,
  text routes kept) and `tests/test_classifier_interface.py`.
- Smoke check: importing the full FastAPI app (all routers) with dummy env vars
  works; voice routes are `enhance-transcript`, `process`, `process-stream`.

### Observation (not changed)
The pins in `requirements.txt` do not match what is installed in the local venv
(e.g. `fastapi==0.104.1` vs 0.128.0 installed, `pydantic==2.5.0` vs 2.12.5,
`google-generativeai==0.3.2` vs 0.8.6). I did not check whether the file resolves
with a fresh `pip install -r`.

## Phase 4: command mapper

Files: `backend-python/services/command_mapper.py`,
`backend-python/services/command_map.json`, `backend-python/tests/test_command_mapper.py`.

`command_map.json` is the **single source of truth** for the keyword -> action
table. The Go pipeline (Phase 6) loads the same file, so the two implementations
cannot drift apart. It covers all 37 classes exactly once: 25 commands + 12
no-action words (`bed bird cat dog happy house marvin sheila tree wow unknown silence`).

| Spoken | Action | Params |
| --- | --- | --- |
| go / stop | `execute_active_file` / `stop_execution` | |
| on / off | `toggle_focus_mode` | `direction: enter` / `exit` |
| up / down | `scroll` | `direction: up` / `down` |
| left / right | `switch_tab` | `direction: left` / `right` |
| yes / no | `confirm` / `cancel` | |
| forward / backward | `redo` / `undo` | |
| learn / visual / follow | `toggle_task_chunking` / `toggle_theme` / `toggle_chat_panel` | |
| zero ... nine | `select_tab_0` ... `select_tab_9` | |

Decision order: `no_action` word -> `no_action_word`; label not in the map ->
`unknown_label`; `confidence < threshold` -> `below_threshold`; else `mapped`.
Each result carries a `reason` so the UI can say *why* nothing happened.

### Assumptions
- **The threshold is inclusive**: `confidence == 0.75` fires; `0.7499999` does not.
- **Threshold precedence:** constructor argument, then
  `AMBATUCODE_CONFIDENCE_THRESHOLD`, then `confidence_threshold` in the JSON, then
  0.75. A malformed or out-of-range env value raises instead of being ignored.
  `AMBATUCODE_COMMAND_MAP` can point at a different map file.
- **Label matching is exact and case-sensitive.** `"GO"` is an `unknown_label`, which
  surfaces a misbehaving classifier instead of hiding it.
- **`select_tab_N` keeps the spoken digit in the action name** (as specified). How the
  frontend interprets N is decided in Phase 7: 1-9 select the 1st-9th open tab and
  0 selects the 10th, matching the usual Alt+1..9 / Alt+0 tab shortcuts.
- Unspecified details that I chose: `reason` values, the `params` shape, and
  `version` / `description` fields in the JSON (both ignored by loaders).

### Tests (107)
Every mapping (25 commands, 12 no-action words x 3 confidences), the exact
37-class set, threshold boundaries (0.75 inclusive, 0.7499999, 0.0, 1.0),
constructor / env / JSON threshold precedence, bad thresholds, exact-match
labels, `map_output`, defensive copies, serialised shape, and malformed-map
validation. The expectations are written out independently of the JSON; changing
`backward` to `redo` in the JSON makes two tests fail (checked, then restored).
