-- =====================================================================
-- LostLink - database UPDATE script
-- Run this whole file in: Supabase > SQL Editor > New query > Run
-- It brings an existing LostLink database up to date. It is safe to run
-- more than once, and it does not delete any data.
-- =====================================================================

-- 1. Student ID: "2" + 6 digits (e.g. 2412345), or ADMIN for the admin account
alter table user_profile drop constraint if exists user_profile_student_id_check;
alter table user_profile add constraint user_profile_student_id_check
    check (student_id ~ '^2[0-9]{6}$' or student_id = 'ADMIN') not valid;

-- 2. Phone: 012-3456789, 0123456789 or +60123456789. Optional for the admin.
alter table user_profile drop constraint if exists user_profile_phone_check;
alter table user_profile add constraint user_profile_phone_check
    check (phone ~ '^(\+?6)?01[0-9]-?[0-9]{7,8}$') not valid;
alter table user_profile alter column phone drop not null;

-- 3. Functions (latest versions)
create or replace function is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
    select exists (
        select 1 from user_profile
        where id = auth.uid() and role = 'Admin' and status = 'Active'
    );
$$;

create or replace function handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
    -- users made in the Supabase dashboard (the admin) have no register-form details
    if new.raw_user_meta_data ->> 'student_id' is null then
        return new;
    end if;
    insert into user_profile (id, name, student_id, email, phone)
    values (
        new.id,
        new.raw_user_meta_data ->> 'name',
        upper(new.raw_user_meta_data ->> 'student_id'),
        new.email,
        new.raw_user_meta_data ->> 'phone'
    );
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function handle_new_user();

create or replace function check_registration(p_email text, p_student_id text)
returns text
language plpgsql stable security definer set search_path = public
as $$
begin
    if exists (select 1 from user_profile where lower(email) = lower(p_email)) then
        return 'This email is already registered.';
    end if;
    if exists (select 1 from user_profile where student_id = upper(p_student_id)) then
        return 'This student ID is already registered.';
    end if;
    return null;
end;
$$;
grant execute on function check_registration(text, text) to anon, authenticated;

create or replace function set_user_status(p_user_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
    if not is_admin() then
        raise exception 'Only admin can change user status.';
    end if;
    if p_user_id = auth.uid() then
        raise exception 'You cannot deactivate your own account.';
    end if;
    update user_profile set status = p_status where id = p_user_id;
end;
$$;
grant execute on function set_user_status(uuid, text) to authenticated;

-- 4. Chat table (skipped if it already exists)
create table if not exists chat_message (
    id          bigint generated always as identity primary key,
    student_id  uuid not null references user_profile(id) on delete cascade,
    sender_id   uuid not null references user_profile(id) on delete cascade,
    message     text not null check (length(trim(message)) between 1 and 500),
    is_edited   boolean not null default false,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz
);

create or replace function check_chat_update()
returns trigger
language plpgsql
as $$
begin
    if new.student_id <> old.student_id or new.sender_id <> old.sender_id then
        raise exception 'You cannot move a message to another chat.';
    end if;
    new.is_edited := true;
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists chat_update_rules on chat_message;
create trigger chat_update_rules
    before update on chat_message
    for each row execute function check_chat_update();

alter table chat_message enable row level security;
drop policy if exists "student reads own chat, admin reads all" on chat_message;
drop policy if exists "send message" on chat_message;
drop policy if exists "edit own message" on chat_message;
drop policy if exists "delete own message" on chat_message;
create policy "student reads own chat, admin reads all" on chat_message for select to authenticated
    using (student_id = auth.uid() or is_admin());
create policy "send message" on chat_message for insert to authenticated
    with check (sender_id = auth.uid() and (student_id = auth.uid() or is_admin()));
create policy "edit own message" on chat_message for update to authenticated
    using (sender_id = auth.uid()) with check (sender_id = auth.uid());
create policy "delete own message" on chat_message for delete to authenticated
    using (sender_id = auth.uid());

do $$
begin
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and tablename = 'chat_message') then
        alter publication supabase_realtime add table chat_message;
    end if;
end $$;

-- 5. Admin account: give the admin login an Admin profile.
--    The login itself must be created first in:
--    Authentication > Users > Add user  (admin@tarc.edu.my, tick "Auto Confirm User")
insert into user_profile (id, name, student_id, email, role, status)
select id, 'Admin', 'ADMIN', email, 'Admin', 'Active'
from auth.users
where email = 'admin@tarc.edu.my'
on conflict (id) do update set role = 'Admin', status = 'Active';

-- 6. Result: this row tells you if the admin account is ready
select
    (select count(*) from auth.users where email = 'admin@tarc.edu.my')            as admin_login_exists,
    (select email_confirmed_at is not null from auth.users where email = 'admin@tarc.edu.my') as admin_email_confirmed,
    (select role || ' / ' || status from user_profile where email = 'admin@tarc.edu.my')     as admin_profile,
    (select count(*) from user_profile)                                              as total_profiles;
