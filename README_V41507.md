# KeySuite V4.15.07

## Customer Preferences — default OFF

### Key → Customer → Brand / Series Price Preference
All Price checkboxes start **unticked** for a new / unset customer preference.

### Left Panel → Customers → Brand / Series Curve Preference
All Curve / Quick Selection checkboxes start **unticked** for a new / unset customer preference.

The hierarchy remains:

**Role Brand Authorized → Customer Price Preference → Customer Curve Preference**

A Curve option only becomes available after its Price is enabled.

Existing explicitly saved customer ticks are preserved. This change affects the default state for customers without a saved preference.

## CHC G1 Motor

All CHC G1 Product Quote / Assembly payloads now use:

**IE2 Motor**

CHC G1 still has:
- Price / Quote / Assembly
- no Curve
- no hydraulic Selection

## Protected
No changes to CHC G2 curve, CHC selector, ES selector, Price List, pricing engine, multi-brand quotation mapping, or PDF layout.

## Supabase
No new SQL required.
