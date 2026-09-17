# The Panel's Wall — direction boards (2026-09-17)

Static design boards for the public surface: the home page and the four
screens of the public Role Builder. They are the reference for implementing
`src/app/(marketing)/DESIGN.md`; the copy on them is the site copy.

Each `*.dc.html` is a self-contained artboard (the `./support.js` line is the
canvas editor's runtime and can be ignored; everything else is plain HTML and
CSS). `wall.css` holds the tokens and the component styles shared by all of
them. Open any board in a browser to see it; the Google Fonts link in each
`<helmet>` is for the boards only — the site vendors its fonts.

| Board | What it is |
|---|---|
| `Main.dc.html` | Home, desktop 1440 wide — the committed direction |
| `Home-phone.dc.html` | Home at 390 wide |
| `Build-brief.dc.html` | Role Builder: job title, position description, tier |
| `Build-working.dc.html` | Role Builder: progress narration while the role is read and capabilities pinned |
| `Build-result.dc.html` | Role Builder: pinned capabilities, close alternatives, detail card, create |
| `Build-sent.dc.html` | Role Builder: link sent |
| `Main-light.dc.html` | A light-ground variant of the first viewport, kept only for the ground-colour question; not the committed world |

Decisions that post-date the boards and override them where they differ:

- Show **overall** item counts only ("36 items · about 7 min"); never a
  per-capability count.
- The live canvas is at https://claude.ai/artifact/CJAeDeoDb1HK1tcuAZX7Hf
  (private).
