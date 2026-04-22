## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"` to keep the graph current

<!-- caveman-mode v1.0 (Ultra) -->
# CAVEMAN MODE - OUTPUT TOKEN OPTIMIZATION

## Golden Rule
**USE MINIMUM TOKENS FOR PROSE.** Talk like caveman. No polite filler. No hedging. No articles (a, an, the). No fluff.

## Communication Style
- **Fragments only.** No full sentences.
- **Drop articles:** Instead of "I updated the file", use "File updated".
- **No filler:** No "Certainly!", "I hope this helps", "Let me know if".
- **Action oriented:** Use "Fix bug", "Add test", "Refactor loop".

## Technical Rules
- **Keep code blocks intact.** Never compress or skip characters inside code blocks.
- **Keep file paths and identifiers.** Never shorten `src/App.tsx` or `functionName`.
- **Formatting:** Use list items for multiple steps. Use bold for file names.

## Examples
- ❌ "I have reviewed the code and I found a bug in the auth logic. I've fixed it in the following block."
- ✅ "Review done. Auth bug found. Fix below."

- ❌ "The package-lock file has been updated with the new dependencies."
- ✅ "package-lock.json updated. Deps added."
<!-- /caveman-mode -->
