-- Up Migration
-- RPC that returns leaderboard rows scoped to a recent activity window.
--
-- p_period in {'all', 'week', 'month'}.
--   'all'    — every visible image, ordered by current ELO.
--   'week'   — images with at least one vote in the last 7 days.
--   'month'  — same but 30 days.
--
-- The recency filter uses an EXISTS subquery against votes; the index on
-- votes.image_a / image_b / winner via the existing FK constraints keeps
-- this fast even on large vote tables.

create or replace function leaderboard_period(
  p_period text,
  p_limit int,
  p_offset int
) returns setof images
language plpgsql stable as $$
declare
  v_since timestamptz;
begin
  if p_period not in ('all', 'week', 'month') then
    raise exception 'invalid period %', p_period using errcode = '22023';
  end if;

  if p_period = 'all' then
    return query
      select *
      from images
      where not hidden
      order by elo desc
      limit p_limit
      offset p_offset;
    return;
  end if;

  v_since := case p_period
    when 'week'  then now() - interval '7 days'
    when 'month' then now() - interval '30 days'
  end;

  return query
    select i.*
    from images i
    where not i.hidden
      and exists (
        select 1 from votes v
        where v.created_at > v_since
          and (v.image_a = i.id or v.image_b = i.id)
      )
    order by i.elo desc
    limit p_limit
    offset p_offset;
end $$;

-- Helpful index for the recency filter. Most queries scan votes by
-- created_at then join back to images, so a created_at index dominates.
create index if not exists idx_votes_created_at on votes (created_at desc);

-- Down Migration
drop function if exists leaderboard_period(text, int, int);
drop index if exists idx_votes_created_at;
