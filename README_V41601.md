# KeySuite V4.16.01

Product → CHC impeller configuration enhancement.

## Added
- Product CHC Impeller Configuration editor with F (Full), S (Small) and M (Mini) lists.
- F + S + M is always locked to the remaining physical impeller count.
- Reduce Impeller list supports `(-n)` model notation.
- Example: CHC 8-200 with Reduce Impeller = 2 displays `CHC 8-200 (-2)` and uses CHC 8-180 hydraulic performance.
- Exact F/S/M combinations resolve to the matching catalog model when one exists.
- Non-catalog F/S/M combinations are treated as Custom hydraulic curves.
- Custom mixed curves use head-weighted efficiency from the remaining impellers.
- Selection mode remains unchanged; this editor is Product-mode only.
- Export payload now carries base/display/hydraulic-equivalent model and F/S/M/reduction counts.

No new Supabase SQL is required.
