# /optimize

Review $ARGUMENTS (or the full codebase if no argument is given) for performance, readability, and efficiency issues. Follow these steps exactly:

1. **Read the code** — explore the target files/directories and identify concrete issues across three axes:
   - **Performance**: unnecessary re-renders, expensive operations in hot paths, missing memoization, unneeded network calls
   - **Readability**: unclear naming, overly complex logic that can be simplified, dead code
   - **Efficiency**: duplicate logic, missing early exits, avoidable work

2. **Write a plan** — create or update `tasks/todo.md` with a markdown checklist. Each item should name the file, the issue, and the fix. Example:
   ```
   - [ ] `src/Calendar.tsx` — memoize `getVisibleDays` to avoid recalculating on every render
   ```

3. **Work through each item** — make the smallest targeted change that fixes the issue. After each fix:
   - Mark the item `- [x]`
   - Write one sentence explaining what changed and why

4. **Keep changes minimal** — do not refactor surrounding code, rename unrelated things, or fix issues outside the checklist. If you spot something worth a separate task, note it at the bottom of `tasks/todo.md` under `## Future`.

5. **Add a Review section** — when all items are done, append to `tasks/todo.md`:
   ```markdown
   ## Review
   Summary of all changes made, grouped by axis (Performance / Readability / Efficiency).
   ```
