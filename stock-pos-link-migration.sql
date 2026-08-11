-- Leman's Deli POS -> stok otomatik düşme bağlantısı
-- Önce stock-migration.sql çalıştırılmış olmalıdır.

alter table pos_orders
  add column if not exists stock_applied_at timestamptz;

alter table menu_items
  add column if not exists stock_item_id bigint references stock_items(id),
  add column if not exists stock_usage_quantity numeric(14,3),
  add column if not exists stock_usage_unit text;

create index if not exists menu_items_stock_item_id_idx
  on menu_items(stock_item_id);

create unique index if not exists stock_sale_once_per_order_item
  on stock_movements(reference_type, reference_id, stock_item_id)
  where reference_type = 'pos_order_item';

create or replace function public.convert_stock_quantity(
  p_quantity numeric,
  p_from_unit text,
  p_to_unit text
)
returns numeric
language plpgsql
immutable
as $$
begin
  if p_quantity is null then
    return 0;
  end if;

  if p_from_unit = p_to_unit then
    return p_quantity;
  end if;

  if p_from_unit = 'gr' and p_to_unit = 'kg' then
    return p_quantity / 1000;
  end if;

  if p_from_unit = 'kg' and p_to_unit = 'gr' then
    return p_quantity * 1000;
  end if;

  if p_from_unit = 'ml' and p_to_unit = 'lt' then
    return p_quantity / 1000;
  end if;

  if p_from_unit = 'lt' and p_to_unit = 'ml' then
    return p_quantity * 1000;
  end if;

  if p_from_unit = 'adet' and p_to_unit = 'adet' then
    return p_quantity;
  end if;

  raise exception 'Birim dönüşümü desteklenmiyor: % -> %', p_from_unit, p_to_unit;
end;
$$;

create or replace function public.apply_stock_for_pos_order(p_order_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order pos_orders%rowtype;
  v_row record;
  v_usage numeric;
  v_stock_unit text;
  v_processed integer := 0;
begin
  select *
  into v_order
  from pos_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Adisyon bulunamadı: %', p_order_id;
  end if;

  if v_order.status <> 'closed' then
    raise exception 'Stok yalnızca kapanan adisyonda düşürülebilir.';
  end if;

  if v_order.stock_applied_at is not null then
    return jsonb_build_object(
      'applied', false,
      'reason', 'already_applied',
      'processed', 0
    );
  end if;

  for v_row in
    select
      poi.id as order_item_id,
      poi.menu_item_id,
      poi.product_name,
      poi.quantity as sold_quantity,
      poi.portion_type,
      poi.weight_grams,
      mi.stock_item_id,
      mi.stock_usage_quantity,
      coalesce(mi.stock_usage_unit, si.unit) as usage_unit,
      si.unit as stock_unit,
      si.current_quantity
    from pos_order_items poi
    join menu_items mi on mi.id = poi.menu_item_id
    join stock_items si on si.id = mi.stock_item_id
    where poi.order_id = p_order_id
      and mi.stock_item_id is not null
  loop
    if exists (
      select 1
      from stock_movements sm
      where sm.reference_type = 'pos_order_item'
        and sm.reference_id = v_row.order_item_id
        and sm.stock_item_id = v_row.stock_item_id
    ) then
      continue;
    end if;

    if v_row.portion_type = 'weight' then
      v_usage := public.convert_stock_quantity(
        coalesce(v_row.weight_grams, 0) * coalesce(v_row.sold_quantity, 1),
        'gr',
        v_row.stock_unit
      );
    else
      v_usage := coalesce(v_row.stock_usage_quantity, 0)
        * coalesce(v_row.sold_quantity, 1)
        * case when v_row.portion_type = 'half' then 0.5 else 1 end;

      v_usage := public.convert_stock_quantity(
        v_usage,
        coalesce(v_row.usage_unit, v_row.stock_unit),
        v_row.stock_unit
      );
    end if;

    if v_usage <= 0 then
      continue;
    end if;

    update stock_items
    set
      current_quantity = current_quantity - v_usage,
      updated_at = now()
    where id = v_row.stock_item_id;

    insert into stock_movements (
      stock_item_id,
      movement_type,
      quantity,
      reference_type,
      reference_id,
      note
    ) values (
      v_row.stock_item_id,
      'sale',
      -v_usage,
      'pos_order_item',
      v_row.order_item_id,
      'POS satışı: ' || v_row.product_name || ' / Adisyon ' || v_order.receipt_number
    );

    v_processed := v_processed + 1;
  end loop;

  update pos_orders
  set stock_applied_at = now()
  where id = p_order_id;

  return jsonb_build_object(
    'applied', true,
    'processed', v_processed
  );
end;
$$;

grant execute on function public.apply_stock_for_pos_order(bigint)
to authenticated;
