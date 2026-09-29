-- Run once in Supabase SQL Editor. Jobs are accessible only through the POS API.
create table if not exists public.pos_print_jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid not null,
  receipt_number text not null,
  document jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'printing', 'done', 'failed')),
  attempts integer not null default 0,
  worker_id text,
  lease_token uuid,
  leased_until timestamptz,
  finished_at timestamptz,
  last_error text
);

create index if not exists pos_print_jobs_pending_idx
  on public.pos_print_jobs (created_at)
  where status in ('pending', 'printing');

alter table public.pos_print_jobs enable row level security;
revoke all on public.pos_print_jobs from anon, authenticated;
grant select, insert, update on public.pos_print_jobs to service_role;

-- The row lock prevents two desktop agents from claiming the same job.
create or replace function public.claim_pos_print_job(p_worker_id text)
returns setof public.pos_print_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.pos_print_jobs
  set status = 'failed', leased_until = null, lease_token = null,
      last_error = 'Yazıcı aracısı son denemede yanıt vermedi.'
  where status = 'printing' and leased_until < now() and attempts >= 3;

  return query
    update public.pos_print_jobs j
    set status = 'printing',
        worker_id = p_worker_id,
        lease_token = gen_random_uuid(),
        leased_until = now() + interval '3 minutes',
        attempts = j.attempts + 1,
        last_error = null
    where j.id = (
      select q.id from public.pos_print_jobs q
      where q.status = 'pending'
         or (q.status = 'printing' and q.leased_until < now() and q.attempts < 3)
      order by q.created_at
      for update skip locked
      limit 1
    )
    returning j.*;
end;
$$;

revoke all on function public.claim_pos_print_job(text) from public, anon, authenticated;
grant execute on function public.claim_pos_print_job(text) to service_role;
