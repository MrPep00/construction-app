-- Adds optional pallet size to inventory items.
-- pallet_qty = number of units (e.g. szt) per one pallet.
-- NULL means no pallet conversion is configured for this item.

alter table inventory_items
  add column pallet_qty integer check (pallet_qty > 0);
