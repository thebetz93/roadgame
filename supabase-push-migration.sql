-- Run this once in your Supabase SQL editor to add push notification support
alter table profiles add column if not exists push_subscription jsonb default null;
