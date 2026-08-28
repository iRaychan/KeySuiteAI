# KeySuite V4.15.04

## Brand / Series Settings — Price + Selection

Customer Brand / Series Settings now shows:

**Brand Series | Price | Selection**

Hierarchy:

**Role Brand Authorization → Price Preference → Selection Preference**

- Price ON + Selection ON → Price/Quote + Quick Selection/Curve available
- Price ON + Selection OFF → Price/Quote available, Selection/Curve hidden
- Price OFF → Price/Quote unavailable and Selection/Curve automatically unavailable

### CHC G1
CHC G1 keeps its own Price List and remains quoteable when Price is enabled.
Curve / hydraulic Selection remains unavailable, so Selection shows `No curve`.

### CHC G2
CHC G2 requires Price ON for quotation and both Price + Selection ON for Quick Selection/Curve.

The new `price_keys` are stored inside the existing customer preference JSON, so no new Supabase SQL is required.

## Selling Brand on Quotation

Named Brands use the selected selling Brand.
Special Brand named/code **OEM** is unbranded: no `B.G.Reich`, no `OEM`, mapped selling series/model only.

## Customers → Terms (days)

- `60` → `60 days`
- `30` → `30 days`
- `0` → `Cash before delivery`

Older stored values such as `30 days` are normalized automatically.

## Protected
No changes to Product CHC logic, Product curve selector, CHC hydraulic selector, ES selector, Price List module/data, or quotation PDF layout.

## Supabase
No new SQL required.
