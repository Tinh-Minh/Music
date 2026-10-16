# ANTIGRAVITY SKILLS PACK — 20 skill tiết kiệm quota

File này gom 20 skill. Mỗi skill bắt đầu bằng một dòng comment dạng `SKILL: tên-skill` (xem bên dưới) và nội dung SKILL.md ngay sau đó.
Nội dung skill viết bằng tiếng Anh ngắn gọn (ít token hơn → tiết kiệm quota), agent vẫn trả lời bạn bằng tiếng Việt nhờ skill `vietnamese-concise-reply`.

## Cách cài (1 lệnh)

1. Lưu đoạn script dưới đây thành `install_skills.py`, để cạnh file này:

```python
import re, pathlib, sys
src = pathlib.Path("ANTIGRAVITY_SKILLS.md").read_text(encoding="utf-8")
dest = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".agent/skills")
parts = re.split(r"<!-- SKILL: ([a-z0-9-]+) -->\n", src)
for name, body in zip(parts[1::2], parts[2::2]):
    d = dest / name
    d.mkdir(parents=True, exist_ok=True)
    (d / "SKILL.md").write_text(body.strip() + "\n", encoding="utf-8")
    print("OK", d)
```

2. Chạy:
   - Cho 1 project (chạy ở thư mục gốc project): `python install_skills.py`
   - Dùng cho mọi project (global): `python install_skills.py ~/.gemini/antigravity/skills`
     (Windows: `python install_skills.py %USERPROFILE%\.gemini\antigravity\skills`)
3. Restart phiên agent trong Antigravity để nó nhận skill mới.

Mẹo: không cần cài hết. Mỗi skill đều tốn một ít token cho phần `description`, nên bỏ skill nào bạn không dùng (ví dụ 2 skill Spring Boot ở cuối nếu làm project khác).

---

<!-- SKILL: quota-saver-core -->
---
name: quota-saver-core
description: Always-on efficiency rules to minimize token and quota usage. Use at the start of every coding task.
---

# Quota Saver Core

1. Restate the goal in one line. If ambiguous, ask ONE question instead of guessing.
2. Read the minimum: search first, open only relevant files or line ranges.
3. Prefer targeted edits over rewriting whole files.
4. Do not re-read files already in context.
5. Do not run commands whose output you will not use. Limit output (`| head`, `| tail`, quiet flags).
6. No unrequested extras: no extra docs, tests, refactors, or long summaries.
7. After 2 failed attempts with the same approach, stop and report instead of looping.
8. Final reply max 6 lines: what changed, which files, how to verify.

<!-- SKILL: scoped-code-search -->
---
name: scoped-code-search
description: Find code with search before opening files. Use when locating a class, function, config key, or error source in a codebase.
---

# Scoped Code Search

1. Use grep/ripgrep or the IDE symbol search for the exact identifier, endpoint path, or error text first.
2. Open only the matching file, and only the needed line range.
3. Exclude noise: `node_modules`, `target`, `build`, `dist`, `.git`, logs, lockfiles.
4. Never list or open whole directories "to get an overview" unless asked.
5. If more than 5 files match, narrow the query instead of opening them all.

<!-- SKILL: minimal-diff-edits -->
---
name: minimal-diff-edits
description: Make the smallest possible code change. Use for any edit, bug fix, or small feature.
---

# Minimal Diff Edits

1. Change only the lines required for the task.
2. Do not reformat, rename, reorder imports, or "clean up" unrelated code.
3. Do not rewrite a whole file when a few lines change.
4. Keep existing style and naming conventions of the file.
5. If a bigger refactor looks useful, mention it in one line and do NOT do it unless asked.

<!-- SKILL: plan-then-execute -->
---
name: plan-then-execute
description: Short plan before multi-file or risky changes, then execute once. Use for tasks touching 3+ files or unclear scope.
---

# Plan Then Execute

1. Write a plan of at most 5 bullets: files to touch, change per file, how to verify.
2. For small tasks (1-2 files, clear scope) skip the plan and just do it.
3. Execute the plan in order without re-planning. Re-plan only if a step proves impossible.
4. Do not write long design essays or alternatives unless asked.

<!-- SKILL: task-decomposition -->
---
name: task-decomposition
description: Split a large request into small verified steps. Use when the request has many parts or would need a very long single run.
---

# Task Decomposition

1. Split the request into independent steps, each completable and verifiable alone.
2. Do step 1 only, verify, report in 2-3 lines, then wait or continue to the next step.
3. Suggest the user run each big step as a fresh conversation if context is getting large.
4. Never start all steps in parallel on a shared codebase without asking.

<!-- SKILL: prompt-refiner -->
---
name: prompt-refiner
description: Rewrite a vague user request into a precise, low-cost prompt. Use when the user says "refine my prompt" or the request is vague.
---

# Prompt Refiner

Rewrite the request into this template (max 10 lines):

- Goal: one sentence.
- Context: relevant files/paths/modules only.
- Constraints: stack, versions, style, things NOT to touch.
- Acceptance: how we know it works (command or behavior).
- Output: what to return (code only, diff only, short summary).

Return the refined prompt in a single code block, ready to copy-paste. Do not execute it.

<!-- SKILL: stop-retry-loops -->
---
name: stop-retry-loops
description: Prevent wasteful repeated attempts. Use whenever a command, test, or fix fails more than once.
---

# Stop Retry Loops

1. After the first failure, read the full error once and form a hypothesis.
2. Try ONE targeted fix. If it fails with the same or a similar error, stop.
3. Report: what you tried, the exact error (last 10-20 lines), your best hypothesis, and 1-2 options for the user.
4. Never retry the identical command or edit hoping for a different result.
5. Never "fix" by deleting tests, disabling checks, or suppressing errors.

<!-- SKILL: systematic-debugging -->
---
name: systematic-debugging
description: Debug with a cheap, ordered method. Use when something is broken, throws an error, or behaves unexpectedly.
---

# Systematic Debugging

1. Read the error message and the first relevant stack frame in project code.
2. Find the exact line, open only that area.
3. State one hypothesis in a sentence, then verify it with the cheapest check (a log line, a single test, a curl).
4. Apply the smallest fix. Re-run only the failing check.
5. If the cause is still unknown after 2 hypotheses, report findings and ask the user.

<!-- SKILL: log-and-output-trimming -->
---
name: log-and-output-trimming
description: Keep terminal and log output small. Use when running builds, tests, servers, or reading log files.
---

# Log And Output Trimming

1. Read only the tail or the matching window of logs: `tail -n 80`, or grep for `ERROR|Exception|FAILED` with a few lines of context.
2. Use quiet or summary flags for builds and tests (e.g. `-q`, `--silent`, `--no-progress`).
3. Redirect noisy output to a file and read only the relevant part.
4. Never paste huge logs back into the reply; quote 5-15 key lines.
5. Do not start long-running servers or watchers unless needed, and stop them when done.

<!-- SKILL: test-minimal-run -->
---
name: test-minimal-run
description: Run only the tests affected by a change. Use after editing code that has tests.
---

# Minimal Test Run

1. Run the single test class or module related to the change first.
2. Run the full suite only once at the end, and only if the user wants it or the change is wide.
3. Do not write new tests unless asked, except one focused test for a bug fix if none exists.
4. Report as: passed/failed count plus the first failing assertion.

<!-- SKILL: code-review-diff-only -->
---
name: code-review-diff-only
description: Review only the changed code. Use when the user asks for a code review or "check my changes".
---

# Code Review (Diff Only)

1. Get the diff (`git diff` or `git diff --staged`) and review only changed lines plus minimal surrounding context.
2. Check in order: correctness bugs, security issues, error handling, performance traps, naming/readability.
3. Output a list of max 10 findings, each as: `file:line — issue — suggested fix`. Order by severity.
4. If nothing serious, say so in one line. Do not invent issues.

<!-- SKILL: git-commit-helper -->
---
name: git-commit-helper
description: Write short conventional commit messages from the diff. Use when the user asks for a commit message or to commit.
---

# Git Commit Helper

1. Read `git diff --staged` (or `git diff` if nothing is staged), not the whole repo.
2. Format: `type(scope): summary` with type in feat, fix, refactor, docs, test, chore. Summary under 72 chars, imperative mood.
3. Add a body only if the "why" is not obvious (max 3 lines).
4. Never commit or push unless the user explicitly asks.

<!-- SKILL: safe-refactor-small-steps -->
---
name: safe-refactor-small-steps
description: Refactor in small, verifiable steps without behavior change. Use only when the user explicitly asks to refactor or clean up code.
---

# Safe Refactor In Small Steps

1. Confirm the scope (which class/module) before starting.
2. One kind of change per step (rename, extract method, move class). Do not mix them.
3. Run the relevant tests after each step if tests exist.
4. Behavior must not change. Do not touch public API signatures without asking.
5. Stop when the stated goal is reached. No bonus cleanups.

<!-- SKILL: browser-agent-guard -->
---
name: browser-agent-guard
description: Avoid unnecessary browser automation, screenshots, and recordings. Use before opening a browser or taking screenshots.
---

# Browser Agent Guard

Browser and screenshot steps are expensive. Use them only when the task truly needs a visual or live-web check.

1. Prefer reading code, running `curl`/HTTP requests, or checking logs to verify behavior.
2. Open the browser only for UI/visual verification or pages that cannot be fetched otherwise.
3. One browser session, one clear goal, then close it. Do not wander or explore.
4. Do not take screenshots or recordings unless asked or required as proof.

<!-- SKILL: mode-and-model-selection -->
---
name: mode-and-model-selection
description: Advise which mode and model fit the task to save quota. Use when the user asks which model or mode to use, or when a trivial task is running in a heavy setup.
---

# Mode And Model Selection

Tell the user briefly (2-4 lines) which setup fits, if the interface offers these options:

- Trivial edits, renames, small fixes, commit messages, explanations: fast mode and a lighter/cheaper model.
- Multi-file features, architecture, hard bugs: planning mode and a stronger model.
- Starting a fresh conversation is often cheaper than continuing a very long one.
- Quota rules differ per account and plan; if unsure, tell the user to check the usage/quota page rather than guessing numbers.

<!-- SKILL: session-handoff -->
---
name: session-handoff
description: Summarize the session into a compact handoff note for a fresh conversation. Use when context is long, quality drops, or the user says "handoff", "tóm tắt để qua chat mới".
---

# Session Handoff

Produce a note of max 25 lines, in one code block, with:

- Goal and current status (done / in progress / blocked).
- Files changed and the key decisions made.
- Commands to run/verify and their last result.
- Open problems and the exact next step.

Skip history of failed attempts unless it prevents repeating a mistake. The user will paste this into a new conversation.

<!-- SKILL: vietnamese-concise-reply -->
---
name: vietnamese-concise-reply
description: Reply in Vietnamese, short and copy-paste ready. Use for every reply to the user.
---

# Vietnamese Concise Reply

1. Reply in Vietnamese. Keep code, identifiers, commands, and error text in their original language.
2. Be direct. No greetings, no restating the question, no long explanations unless asked.
3. Give copy-paste-ready output: complete code blocks, exact commands, exact file paths.
4. Explain only the non-obvious part, in 1-3 lines.

<!-- SKILL: spring-boot-feature-dev -->
---
name: spring-boot-feature-dev
description: Implement features in Java Spring Boot services following layered structure. Use when adding or changing endpoints, services, repositories, or DTOs in a Spring Boot project.
---

# Spring Boot Feature Dev

1. Follow the existing package layout. Flow: Controller -> Service -> Repository. Keep business logic in the service.
2. Use DTOs for request/response, not entities. Add validation annotations (`@Valid`, `@NotNull`, ...) on request DTOs.
3. Constructor injection only. No field `@Autowired`.
4. Return proper HTTP status codes; handle errors through the existing `@ControllerAdvice` if present.
5. Do not edit `pom.xml` or `application.yml` unless the feature requires it; say so when you do.
6. Verify with a module-scoped build, e.g. `mvn -q -pl <module> -am test` (or the Gradle equivalent), not the whole multi-module build.

<!-- SKILL: microservice-integration-debug -->
---
name: microservice-integration-debug
description: Debug failures between microservices (calls, gateway, config, DTO mismatch). Use when service A cannot call service B, gets 4xx/5xx, timeouts, or wrong data.
---

# Microservice Integration Debug

Check in this order and stop at the first cause found:

1. Is the target service running, and on which port/URL? Is the caller configured with the same one?
2. Config: `application.yml` base URL, service name, profile, env vars.
3. Gateway/discovery routes: path, prefix stripping, service id.
4. Contract: request/response DTO field names, types, and nulls on both sides; HTTP method and path.
5. Client details: Feign/RestTemplate/WebClient timeouts, headers (auth token, content type).
6. Data layer: DB connection, schema/migration, missing seed data.

Read only the log window around the failing request on caller and callee. Reproduce with a single `curl` before changing code.

<!-- SKILL: api-docs-concise -->
---
name: api-docs-concise
description: Write short, accurate API and README documentation. Use when the user asks to document endpoints, a module, or a README.
---

# API Docs (Concise)

1. Derive docs from the actual code (controllers/DTOs); do not invent behavior.
2. Per endpoint: method + path, one-line purpose, request fields, response fields, status codes, and one `curl` example.
3. Use tables for fields. No marketing language, no filler sections.
4. For a README: what it is, how to run, config keys, how to test. Max about 60 lines unless asked.
5. Update existing docs in place instead of creating new files.
