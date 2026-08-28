# KeySuite V4.16.08

## Category Compare View
- Added **CHC G1** and **CHC G2** as separate comparison tabs.
- CHC G1 and CHC G2 load their own category rules.
- Compare View saves both through `keysuite_save_chc_generation_category_rule_v41412`, matching the Normal View behavior.
- No new Supabase SQL is required if the V4.14.12 CHC generation category migration is already installed.
