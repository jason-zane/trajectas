@AGENTS.md

## Efficiency
- Grep/Glob before Read — locate the relevant lines first
- No re-reads — if a file is already in context, don't read it again
- Targeted edits — read the minimal surrounding context needed
- No trailing summaries — the diff speaks for itself
- Minimal exploration — start with the most likely file
- Short responses — answer first, explain only if non-obvious
