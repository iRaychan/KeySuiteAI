# KeySuite V4.16.07

## Category · Zero Margin visual indicator

In **Key → Category → Edit Category**:

- Product Rule buttons whose **Margin = 0%** are filled/highlighted.
- Product Rule buttons whose Margin is greater than 0% keep the normal appearance.
- The currently opened Margin row is also highlighted when its value is 0%.
- The indication updates immediately while editing the Margin field and after Category data reloads.

Example: OEM with Coupling Margin = 0% highlights **Coupling**, while ES Margin > 0% remains normal.

No database / Supabase change is required.
