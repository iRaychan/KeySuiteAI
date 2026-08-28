# KeySuite V4.15.11

## Category Price List Currency
Under **Key → Category → Product Rule**, each product now has three ticks:

- USD
- RMB
- MYR

Default is **0 selected**.

- 0 tick → Price unavailable
- 1 tick → Use that currency only
- 2 ticks → Convert selected two to MYR and use the higher
- 3 ticks → Convert all three to MYR and use the highest
- Blank / 0 source price is ignored

The currency choice is saved independently per Category and Product Rule.

## Supabase
Run `supabase/migrations/V41511_CATEGORY_CURRENCY_SELECTION.sql`.
Optional: `supabase/migrations/V41511_VERIFY_CATEGORY_CURRENCY_SELECTION.sql`.

Existing Category Product Rules have no saved selection, so they begin at **0 selected** after this upgrade until you tick and save them.
