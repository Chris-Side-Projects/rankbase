-- Up Migration
-- Track which generator produced each image so we can ask "which provider's
-- output is winning?". Existing rows get NULL — they predate this column.
alter table images add column if not exists provider text;
create index if not exists idx_images_provider on images (provider);

-- Moderation: a numeric score 0..1 from the moderation pass on the prompt.
-- Low score = safe; high score = flagged. We auto-hide above a threshold
-- (configured in the app) so the leaderboard can't surface flagged content
-- before a human review.
alter table images add column if not exists moderation_score real default 0;
create index if not exists idx_images_moderation
  on images (moderation_score)
  where moderation_score > 0.5;

-- Down Migration
drop index if exists idx_images_moderation;
drop index if exists idx_images_provider;
alter table images drop column if exists moderation_score;
alter table images drop column if exists provider;
