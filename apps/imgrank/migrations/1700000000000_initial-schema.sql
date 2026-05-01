-- Up Migration
-- Initial schema for SkillTracker.

create table if not exists images (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  prompt text not null,
  tags jsonb default '[]',
  elo real default 1000,
  votes integer default 0,
  created_at timestamptz default now()
);

create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  image_a uuid not null references images(id) on delete cascade,
  image_b uuid not null references images(id) on delete cascade,
  winner uuid not null references images(id) on delete cascade,
  device_hash text not null,
  created_at timestamptz default now(),
  unique (image_a, image_b, device_hash)
);

create table if not exists tag_scores (
  tag text primary key,
  score real not null,
  image_count integer not null,
  updated_at timestamptz default now()
);

create index if not exists idx_images_elo on images (elo desc);
create index if not exists idx_images_votes_elo on images (votes asc, elo);
create index if not exists idx_votes_device_hash on votes (device_hash);
create index if not exists idx_tag_scores_score on tag_scores (score desc);

create or replace function update_elo(
  p_winner_id uuid,
  p_winner_elo real,
  p_loser_id uuid,
  p_loser_elo real
) returns void as $$
begin
  update images set elo = p_winner_elo, votes = votes + 1 where id = p_winner_id;
  update images set elo = p_loser_elo, votes = votes + 1 where id = p_loser_id;
end;
$$ language plpgsql;

-- Down Migration
drop function if exists update_elo(uuid, real, uuid, real);
drop index if exists idx_tag_scores_score;
drop index if exists idx_votes_device_hash;
drop index if exists idx_images_votes_elo;
drop index if exists idx_images_elo;
drop table if exists tag_scores;
drop table if exists votes;
drop table if exists images;
