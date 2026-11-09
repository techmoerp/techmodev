-- =============================================================================
-- PHASE 9 — AUDIT BUGFIXES
-- Run this after phase1-phase8 have already been applied.
--
-- Fixes two SQL-level issues found during a full system audit:
--
-- 1. guard_quotation_editable() was defined in phase3_quotations.sql but was
--    never attached to a trigger — pure dead code. It also could not safely be
--    wired up as written: it would have blocked the legitimate
--    rejected -> draft / expired -> draft "reopen" transitions that
--    set_quotation_status() explicitly allows, since old.status would be
--    'rejected'/'expired' ("not in ('draft','sent')") at the moment that
--    transition runs. Editing is already correctly restricted at the UI level
--    (quotation-actions.tsx only shows "Edit" for draft/sent) and at the data
--    level (set_quotation_status governs every status change), so this patch
--    just removes the unused, unsafe-to-attach function rather than wiring it
--    up incorrectly.
--
-- 2. create_stock_adjustment() had no floor check, so a manual "Remove stock"
--    adjustment could drive quantity_on_hand negative if called directly or
--    under a race condition — inconsistent with the client-side check in
--    adjust-stock-modal.tsx ("Can't remove more than what's on hand"). This
--    adds the same guard at the database level for defense-in-depth.
-- =============================================================================

-- 1. Drop the dead, unsafe-to-attach trigger function.
drop function if exists public.guard_quotation_editable();

-- 2. Re-create create_stock_adjustment() with a negative-stock guard.
create or replace function public.create_stock_adjustment(
  p_catalog_item_id uuid,
  p_change_qty numeric,
  p_reason text
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_current_qty numeric;
begin
  if not public.has_manage_access('inventory') then
    raise exception 'You do not have permission to adjust stock.';
  end if;
  if p_change_qty = 0 then
    raise exception 'Adjustment quantity cannot be zero.';
  end if;

  select quantity_on_hand into v_current_qty
  from public.stock_levels
  where catalog_item_id = p_catalog_item_id
  for update;

  if v_current_qty is null then
    v_current_qty := 0;
  end if;

  if v_current_qty + p_change_qty < 0 then
    raise exception 'Cannot remove % units — only % on hand.', abs(p_change_qty), v_current_qty;
  end if;

  perform public.move_stock(p_catalog_item_id, p_change_qty, 'adjustment', 'adjustment', null, p_reason);
end;
$$;
