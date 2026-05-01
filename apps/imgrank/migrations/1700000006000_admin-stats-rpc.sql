-- Up Migration
-- Aggregate stats per generator. Useful for answering "is DALL-E worth the
-- cost?" and "are users gravitating toward Stability or Imagen?".

create or replace function admin_provider_stats()
returns table(
  provider text,
  image_count bigint,
  avg_elo real,
  max_elo real,
  total_votes bigint,
  hidden_count bigint
) language sql stable as $$
  select
    coalesce(i.provider, '(unknown)') as provider,
    count(*)::bigint as image_count,
    coalesce(avg(i.elo), 0)::real as avg_elo,
    coalesce(max(i.elo), 0)::real as max_elo,
    coalesce(sum(i.votes), 0)::bigint as total_votes,
    sum(case when i.hidden then 1 else 0 end)::bigint as hidden_count
  from images i
  group by i.provider
  order by avg_elo desc;
$$;

-- Down Migration
drop function if exists admin_provider_stats();
