-- Up Migration
-- Moderation soft-delete. Hidden images are excluded from /compare and
-- /leaderboard but their vote history is preserved for analytics integrity.
alter table images add column if not exists hidden boolean not null default false;
create index if not exists idx_images_hidden on images (hidden) where hidden = true;

-- Down Migration
drop index if exists idx_images_hidden;
alter table images drop column if exists hidden;
