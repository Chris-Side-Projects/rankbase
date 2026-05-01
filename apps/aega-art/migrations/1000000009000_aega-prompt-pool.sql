create table if not exists aega_prompt_pool (
  id uuid primary key default gen_random_uuid(),
  text text not null unique,
  votes integer not null default 0,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  source text not null default 'seed'  -- 'seed' | 'user'
);
create index if not exists idx_aega_prompt_pool_votes on aega_prompt_pool(votes desc);
create index if not exists idx_aega_prompt_pool_used on aega_prompt_pool(used_at);

create table if not exists aega_prompt_votes (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references aega_prompt_pool(id) on delete cascade,
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_aega_prompt_votes_lookup
  on aega_prompt_votes(prompt_id, ip_hash, created_at desc);

create or replace function aega_vote_on_prompt(p_prompt_id uuid, p_ip_hash text)
returns table(new_votes integer) language plpgsql as $$
declare
  recent_count integer;
  updated_votes integer;
begin
  select count(*) into recent_count
  from aega_prompt_votes
  where prompt_id = p_prompt_id
    and ip_hash = p_ip_hash
    and created_at > now() - interval '1 hour';
  if recent_count > 0 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into aega_prompt_votes (prompt_id, ip_hash) values (p_prompt_id, p_ip_hash);
  update aega_prompt_pool set votes = votes + 1
    where id = p_prompt_id returning votes into updated_votes;
  if updated_votes is null then
    raise exception 'prompt_not_found' using errcode = 'P0002';
  end if;
  return query select updated_votes;
end;
$$;

alter table hourly_images add column if not exists short_prompt text;
alter table hourly_images add column if not exists expanded_prompt text;