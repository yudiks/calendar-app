# /code-review

Review $ARGUMENTS (or the current git diff if no argument is given) for correctness bugs, security issues, and code quality. Follow these steps exactly:

1. **Gather the diff** — if no argument is given, run `git diff HEAD` to get all uncommitted changes. If an argument is given (file path, function name, or PR number), read that target directly.

2. **Read context** — for each changed file, read enough surrounding code to understand intent and invariants before judging.

3. **Find issues across four axes**:
   - **Correctness**: logic errors, off-by-one, wrong conditionals, missing edge cases, unhandled promises/errors
   - **Security**: injection (SQL/XSS/command), auth bypasses, exposed secrets, insecure defaults, missing input validation
   - **Quality**: unclear naming, dead code, unnecessary complexity, missing early exits
   - **Tests**: missing coverage for new logic, test assertions that can never fail

4. **Write a plan** — create or update `tasks/todo.md` with a markdown checklist. Each item must name the file and line, the issue, and the fix. Example:
   ```
   - [ ] `server.js:42` — user input passed directly to shell command; use execFile with arg array instead
   - [ ] `calendar.js:88` — off-by-one: `<=` should be `<` when iterating days array
   ```

5. **Work through each item** — make the smallest targeted change that fixes the issue. After each fix:
   - Mark the item `- [x]`
   - Write one sentence explaining what changed and why

6. **Keep changes minimal** — fix only what is listed. Note anything else worth fixing under `## Future` at the bottom of `tasks/todo.md`.

7. **Add a Review section** — when all items are done, append to `tasks/todo.md`:
   ```markdown
   ## Review
   Summary of all findings and fixes, grouped by axis (Correctness / Security / Quality / Tests).
   ```
