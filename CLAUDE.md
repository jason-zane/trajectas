@AGENTS.md

UI/UX and save/persistence standards: see `docs/ui-standards.md`. Read it before building any UI component or page.

## Efficiency

- Grep/Glob before Read — locate the relevant lines first, then read only those
- No re-reads — if a file is already in context this session, don't read it again
- Targeted edits — read the minimal surrounding context needed, not entire files
- No trailing summaries — don't restate what you just changed; the diff speaks for itself
- Minimal exploration — start with the most likely file; explore further only if needed
- Short responses — answer first, explain only if it adds something non-obvious
