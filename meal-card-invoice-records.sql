create table if not exists public.meal_card_invoice_records (
  id bigint generated always as identity primary key,
  provider text not null check (provider in ('edenred', 'setcard', 'pluxee')),
  request_no text not null,
  external_code text not null unique,
  invoice_date date not null,
  gross_amount numeric(12,2) not null check (gross_amount > 0),
  vat_rate numeric(5,2) not null check (vat_rate between 0 and 20),
  taxable_amount numeric(12,2) not null check (taxable_amount >= 0),
  vat_amount numeric(12,2) not null check (vat_amount >= 0),
  receiver_name text not null,
  receiver_tax_code text not null check (receiver_tax_code ~ '^[0-9]{10}$'),
  receiver_alias text not null,
  receiver_address text not null,
  receiver_city text not null,
  receiver_district text not null,
  receiver_tax_office text not null,
  member_no text,
  status text not null check (status in ('sending', 'sent', 'failed', 'unknown')),
  invoice_no text,
  invoice_uuid text,
  error_message text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (provider, request_no)
);

alter table public.meal_card_invoice_records enable row level security;
