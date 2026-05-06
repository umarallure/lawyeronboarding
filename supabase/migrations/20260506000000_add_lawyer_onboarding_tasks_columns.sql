-- Extend closer_tasks so it can also back the lawyer-onboarding portal task board.
-- Closer rows keep `portal = 'closer'` by default so existing reads/writes are unchanged.
-- Lawyer-onboarding rows set `portal = 'lawyer_onboarding'` and reference an app_users
-- lawyer via `lawyer_user_id` (with a denormalized `lawyer_reference` for display).

alter table public.closer_tasks
  add column if not exists portal text not null default 'closer';

alter table public.closer_tasks
  drop constraint if exists closer_tasks_portal_check;

alter table public.closer_tasks
  add constraint closer_tasks_portal_check
    check (portal in ('closer', 'lawyer_onboarding'));

alter table public.closer_tasks
  add column if not exists lawyer_user_id uuid;

alter table public.closer_tasks
  drop constraint if exists closer_tasks_lawyer_user_id_fkey;

alter table public.closer_tasks
  add constraint closer_tasks_lawyer_user_id_fkey
    foreign key (lawyer_user_id) references auth.users (id) on delete set null;

alter table public.closer_tasks
  add column if not exists lawyer_reference text;

create index if not exists idx_closer_tasks_portal
  on public.closer_tasks using btree (portal);

create index if not exists idx_closer_tasks_lawyer_user_id
  on public.closer_tasks using btree (lawyer_user_id);
