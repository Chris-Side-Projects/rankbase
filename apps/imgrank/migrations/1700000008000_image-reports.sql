-- Up Migration
-- Community reports for user-flagged images. Reports are keyed by device hash
-- rather than account because SkillTracker is currently anonymous-first.

create table if not exists image_reports (
  id uuid primary key default gen_random_uuid(),
  image_id uuid not null references images(id) on delete cascade,
  reason text not null check (reason in ('offensive', 'low_quality', 'copyright', 'nsfw', 'other')),
  device_hash text not null,
  notes text default '',
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz default now(),
  resolved_at timestamptz
);

create index if not exists idx_image_reports_image_created
  on image_reports (image_id, created_at desc);

create index if not exists idx_image_reports_status_created
  on image_reports (status, created_at desc);

create index if not exists idx_image_reports_device_created
  on image_reports (device_hash, created_at desc);

-- Down Migration
drop index if exists idx_image_reports_device_created;
drop index if exists idx_image_reports_status_created;
drop index if exists idx_image_reports_image_created;
drop table if exists image_reports;
