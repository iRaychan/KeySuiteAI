# KeySuite V4.15.10

## OEM VMS quotation — direct CHC quote handoff fix

Root cause in V4.15.09:
The direct CHC Product/Selector quotation route created the quotation row with the technical source identity (`B.G.Reich` / `CHC`) and applied pricing, but it did not pass that finished row back through the selected Selling Brand mapping.

V4.15.10 now does this in the correct order:

1. Use source CHC identity for technical / price lookup.
2. Create and price the quotation row.
3. Force-stamp the currently selected Selling Brand onto the finished row.
4. OEM Brand Type is then rendered unbranded.
5. CHC model/description is converted to the mapped Selling Sub Series, e.g. `VMS`.

Expected OEM quotation description:
`Vertical Multistage Pump Model: VMS ...`

No `B.G.Reich` and no `OEM` prefix.

## Protected
No changes to Product, CHC G2 curve, CHC/ES selectors, Price List, pricing engine, customer preferences, or OEM mapping data.

## Supabase
No SQL required.
