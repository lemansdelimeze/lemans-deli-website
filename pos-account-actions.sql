-- Supabase SQL Editor'de bir kez çalıştırın. Açık masa adisyonları için atomik işlemler.
alter table public.pos_order_items
  add column if not exists is_complimentary boolean not null default false,
  add column if not exists original_unit_price numeric(14,2);
alter table public.pos_orders
  add column if not exists account_table_id bigint references public.pos_tables(id),
  add column if not exists account_label text;
create index if not exists pos_orders_account_table_open_idx
  on public.pos_orders(account_table_id) where status = 'open';

create or replace function public.pos_split_table_order(
  p_order_id bigint, p_lines jsonb
) returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  v_source public.pos_orders%rowtype;
  v_item public.pos_order_items%rowtype;
  v_line jsonb;
  v_quantity numeric;
  v_new_id bigint;
  v_count integer := 0;
  v_seen bigint[] := '{}';
begin
  if not exists (select 1 from public.staff_profiles where user_id = auth.uid()
    and active and role in ('cashier','admin','owner')) then
    raise exception 'POS işlemi için yetkiniz yok.';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'Ayırılacak ürünleri seçin.';
  end if;
  if jsonb_array_length(p_lines) = 0 then raise exception 'Ayırılacak ürünleri seçin.'; end if;
  select * into v_source from public.pos_orders where id = p_order_id for update;
  if not found or v_source.status <> 'open' or v_source.order_type <> 'Masa'
    or coalesce(v_source.source, 'pos') <> 'pos' then
    raise exception 'Yalnızca açık POS masa adisyonu ayrılabilir.';
  end if;
  if coalesce(v_source.discount_amount, 0) <> 0 then
    raise exception 'Hesabı ayırmadan önce genel indirimi kaldırın.';
  end if;
  if v_source.table_id is null and v_source.account_table_id is null then
    raise exception 'Masa hesabı bulunamadı.';
  end if;
  perform 1 from public.pos_tables where id = coalesce(v_source.table_id, v_source.account_table_id) for update;
  insert into public.pos_orders
    (receipt_number, order_type, table_id, account_table_id, account_label, customer_name, order_note,
     subtotal, discount_type, discount_value, discount_amount, total, payment_method, status, source, pos_stage)
  values
    ('OPEN-SPLIT-' || p_order_id || '-' || txid_current(), 'Masa', null,
     coalesce(v_source.table_id, v_source.account_table_id),
     'Hesap ' || (2 + (select count(*) from public.pos_orders where status = 'open'
       and account_table_id = coalesce(v_source.table_id, v_source.account_table_id))),
     v_source.customer_name, v_source.order_note, 0, 'none', 0, 0, 0, 'pending', 'open', 'pos', 'new')
  returning id into v_new_id;

  for v_line in select value from jsonb_array_elements(p_lines) loop
    if jsonb_typeof(v_line->'id') <> 'number' or jsonb_typeof(v_line->'quantity') <> 'number' then
      raise exception 'Geçersiz ürün seçimi.';
    end if;
    if (v_line->>'id')::bigint = any(v_seen) then raise exception 'Aynı ürün birden fazla seçilemez.'; end if;
    v_seen := array_append(v_seen, (v_line->>'id')::bigint);
    select * into v_item from public.pos_order_items
      where id = (v_line->>'id')::bigint and order_id = p_order_id for update;
    v_quantity := (v_line->>'quantity')::numeric;
    if not found or v_quantity <= 0 or v_quantity <> trunc(v_quantity) or v_quantity > v_item.quantity then
      raise exception 'Ürün miktarı değişmiş. Adisyonu yeniden açın.';
    end if;
    if v_quantity = v_item.quantity then
      update public.pos_order_items set order_id = v_new_id where id = v_item.id;
    else
      update public.pos_order_items set quantity = quantity - v_quantity,
        line_total = round(unit_price * (quantity - v_quantity), 2) where id = v_item.id;
      insert into public.pos_order_items
        (order_id, menu_item_id, product_name, quantity, portion_type, portion_label,
         weight_grams, unit_price, line_total, is_complimentary, original_unit_price)
      values (v_new_id, v_item.menu_item_id, v_item.product_name, v_quantity,
        v_item.portion_type, v_item.portion_label, v_item.weight_grams, v_item.unit_price,
        round(v_item.unit_price * v_quantity, 2), v_item.is_complimentary, v_item.original_unit_price);
    end if;
    v_count := v_count + 1;
  end loop;
  if v_count <> jsonb_array_length(p_lines)
    or not exists (select 1 from public.pos_order_items where order_id = p_order_id) then
    raise exception 'Kaynak adisyonda en az bir ürün kalmalıdır.';
  end if;
  update public.pos_orders set subtotal = (select coalesce(sum(line_total), 0) from public.pos_order_items where order_id = p_order_id),
    total = (select coalesce(sum(line_total), 0) from public.pos_order_items where order_id = p_order_id) where id = p_order_id;
  update public.pos_orders set subtotal = (select coalesce(sum(line_total), 0) from public.pos_order_items where order_id = v_new_id),
    total = (select coalesce(sum(line_total), 0) from public.pos_order_items where order_id = v_new_id) where id = v_new_id;
  return v_new_id;
end;
$$;

create or replace function public.pos_merge_table_orders(
  p_target_order_id bigint, p_source_order_id bigint
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_target public.pos_orders%rowtype;
  v_source public.pos_orders%rowtype;
begin
  if not exists (select 1 from public.staff_profiles where user_id = auth.uid()
    and active and role in ('cashier','admin','owner')) then
    raise exception 'POS işlemi için yetkiniz yok.';
  end if;
  if p_target_order_id = p_source_order_id then raise exception 'İki farklı masa seçin.'; end if;
  perform 1 from public.pos_orders where id in (p_target_order_id, p_source_order_id) order by id for update;
  select * into v_target from public.pos_orders where id = p_target_order_id;
  select * into v_source from public.pos_orders where id = p_source_order_id;
  if v_target.id is null or v_source.id is null
    or v_target.status <> 'open' or v_source.status <> 'open'
    or v_target.order_type <> 'Masa' or v_source.order_type <> 'Masa'
    or coalesce(v_target.source, 'pos') <> 'pos'
    or coalesce(v_source.source, 'pos') <> 'pos' then
    raise exception 'Yalnızca açık POS masa adisyonları birleştirilebilir.';
  end if;
  if coalesce(v_target.discount_amount, 0) <> 0 or coalesce(v_source.discount_amount, 0) <> 0 then
    raise exception 'Birleştirmeden önce genel indirimleri kaldırın.';
  end if;
  if v_target.table_id is null then
    raise exception 'Birleştirme için ana masa adisyonunu açın.';
  end if;
  update public.pos_order_items set order_id = p_target_order_id where order_id = p_source_order_id;
  update public.pos_orders set subtotal = (select coalesce(sum(line_total), 0) from public.pos_order_items where order_id = p_target_order_id),
    total = (select coalesce(sum(line_total), 0) from public.pos_order_items where order_id = p_target_order_id),
    order_note = nullif(concat_ws(E'\n', nullif(v_target.order_note, ''), nullif(v_source.order_note, '')), '')
    where id = p_target_order_id;
  update public.pos_orders set status = 'cancelled', pos_stage = 'cancelled',
    cancelled_at = now(), cancelled_by = auth.uid(),
    cancel_reason = 'Ana adisyona birleştirildi: ' || p_target_order_id
    where id = p_source_order_id;
end;
$$;

revoke all on function public.pos_split_table_order(bigint,jsonb) from public;
revoke all on function public.pos_merge_table_orders(bigint,bigint) from public;
grant execute on function public.pos_split_table_order(bigint,jsonb) to authenticated;
grant execute on function public.pos_merge_table_orders(bigint,bigint) to authenticated;
