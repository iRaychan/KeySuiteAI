# KeySuite V4.16.02

Product → CHC collapsible impeller editor + Dashboard Quick Selection Brand / Series preferences.

## Added / Changed
- Product → CHC Impeller Configuration is now collapsible.
- It starts collapsed whenever a Product model is opened or changed.
- If the user expands it and changes F / S / M / Reduce Impeller, it stays expanded while editing.
- Dashboard Quick Selection now exposes **Brand / Series Settings**.
- Each user can choose which of their **Owner-authorized** Brand / Series Quick Selection should search.
- Restricted users cannot enable a Brand / Series outside their assigned Role Brand / Series scope.
- **Select All Allowed**, **Clear All**, and **Save Preference** are available.
- Dashboard Brand / Series Settings also starts collapsed by default.
- Existing Owner Role Brand / Series assignment remains the authority source; no global Brand / Series data is changed.

No new Supabase SQL is required. Existing Quick Selection preference storage remains unchanged.
