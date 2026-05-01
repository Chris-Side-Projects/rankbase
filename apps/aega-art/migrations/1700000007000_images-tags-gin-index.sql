-- Up Migration
-- Tag drill-down queries filter the JSONB tags array by membership.
create index if not exists idx_images_tags_gin on images using gin (tags);

-- Down Migration
drop index if exists idx_images_tags_gin;
