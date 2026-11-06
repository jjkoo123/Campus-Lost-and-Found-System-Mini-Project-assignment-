-- =====================================================================
-- LostLink (Lost and Found Management System) - Database Schema (Supabase / PostgreSQL)
-- Run this whole file once in: Supabase Dashboard > SQL Editor > New query
--
-- Sections:
--   0. Helper functions            (shared)
--   1. user_profile                (A1 User / Account)       - Member A
--   2. category, location          (C2 Category / Location)  - Member C (draft)
--   3. found_item, found_item_secret (C1 Found Item)         - Member C (draft)
--   4. lost_report                 (B1 Lost Report)          - Member B (draft)
--   5. claim                       (A2 Claim Verification)   - Member A
--   6. notification                (B2 Notification)         - Member B (draft)
--
-- Rules followed: singular snake_case names, RLS ON for every table,
-- validation also in DB (NOT NULL, UNIQUE, CHECK).
-- =====================================================================


-- =====================================================================
-- 1. USER PROFILE  (A1)  - extra info for each Supabase Auth user
-- =====================================================================
-- Login (email + password) is stored by Supabase Auth in auth.users.
-- This table keeps the other details and the role.
create table user_profile (
    id          uuid primary key references auth.users(id) on delete cascade,
    user_no     bigint generated always as identity unique,   -- shown as U001
    name        text not null check (length(trim(name)) between 2 and 100),
    -- students: "2" + 6 digits (e.g. 2412345); the admin account uses 'ADMIN'
    student_id  text not null unique check (student_id ~ '^2[0-9]{6}$' or student_id = 'ADMIN'),
    email       text not null unique,
    phone       text check (phone ~ '^01[0-9]-?[0-9]{7,8}$'),   -- required on register form; admin may leave empty
    role        text not null default 'Student' check (role in ('Student', 'Admin')),
    status      text not null default 'Active'  check (status in ('Active', 'Inactive')),
    created_at  timestamptz not null default now()
);


-- =====================================================================
-- 0. HELPER FUNCTIONS (shared)
-- =====================================================================
-- is_admin(): true if the logged-in user is an active Admin.
-- "security definer" = runs with owner rights, so it can read user_profile
-- without being blocked by RLS (avoids an RLS loop).
create or replace function is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
    select exists (
        select 1 from user_profile
        where id = auth.uid() and role = 'Admin' and status = 'Active'
    );
$$;

-- When someone signs up, copy the details they typed into user_profile.
-- register.js sends name / student_id / phone as "user metadata".
-- A user created in the Supabase dashboard (the admin) has no metadata,
-- so no profile is made here - the admin profile is added by the SQL at the bottom.
create or replace function handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
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

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function handle_new_user();

-- Used by the Register page BEFORE sign-up, to show a clear
-- "email / student ID already registered" message.
-- Returns an error message, or null if both are free.
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

-- Admin deactivates / reactivates a user (A1 Delete = soft delete).
-- Soft delete keeps the user's claim history. Admin cannot do it to himself.
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

-- RLS for user_profile
alter table user_profile enable row level security;

create policy "user reads own profile, admin reads all"
    on user_profile for select to authenticated
    using (id = auth.uid() or is_admin());

create policy "user edits own profile"
    on user_profile for update to authenticated
    using (id = auth.uid())
    with check (id = auth.uid());

-- Users may only change name and phone themselves.
-- (role / status / email / student_id cannot be changed from the browser)
revoke update on user_profile from anon, authenticated;
grant update (name, phone) on user_profile to authenticated;


-- =====================================================================
-- 2. CATEGORY & LOCATION  (C2)  - draft, Member C to review
-- =====================================================================
create table category (
    id          bigint generated always as identity primary key,
    name        text not null unique check (length(trim(name)) > 0),
    created_at  timestamptz not null default now()
);

create table location (
    id          bigint generated always as identity primary key,
    name        text not null unique check (length(trim(name)) > 0),
    created_at  timestamptz not null default now()
);

alter table category enable row level security;
alter table location enable row level security;

create policy "anyone reads categories" on category for select using (true);
create policy "admin manages categories" on category for all to authenticated
    using (is_admin()) with check (is_admin());

create policy "anyone reads locations" on location for select using (true);
create policy "admin manages locations" on location for all to authenticated
    using (is_admin()) with check (is_admin());


-- =====================================================================
-- 3. FOUND ITEM  (C1)  - draft, Member C to review
-- =====================================================================
create table found_item (
    id           bigint generated always as identity primary key,   -- FI001
    item_name    text not null check (length(trim(item_name)) > 0),
    category_id  bigint not null references category(id),          -- delete blocked if in use
    location_id  bigint not null references location(id),
    date_found   date not null check (date_found <= current_date),
    description  text not null,
    photo_url    text,
    status       text not null default 'Available'
                 check (status in ('Available', 'Claimed', 'Returned')),
    created_by   uuid references user_profile(id),
    created_at   timestamptz not null default now()
);

-- Secret details kept in a SEPARATE table that only admin can read.
-- (RLS works per row, not per column - if hidden_detail was inside
--  found_item, students could read it and copy it into their claim.)
-- Used by A2 unique feature "claim proof check".
create table found_item_secret (
    found_item_id  bigint primary key references found_item(id) on delete cascade,
    hidden_detail  text not null,
    storage_place  text not null
);

alter table found_item enable row level security;
alter table found_item_secret enable row level security;

create policy "anyone reads found items" on found_item for select using (true);
create policy "admin manages found items" on found_item for all to authenticated
    using (is_admin()) with check (is_admin());

create policy "admin only - secret details" on found_item_secret for all to authenticated
    using (is_admin()) with check (is_admin());


-- =====================================================================
-- 4. LOST REPORT  (B1)  - draft, Member B to review
-- =====================================================================
create table lost_report (
    id           bigint generated always as identity primary key,   -- LR001
    user_id      uuid not null references user_profile(id),
    item_name    text not null check (length(trim(item_name)) > 0),
    category_id  bigint not null references category(id),
    location_id  bigint not null references location(id),
    date_lost    date not null check (date_lost <= current_date),
    description  text not null,
    photo_url    text,
    status       text not null default 'Lost' check (status in ('Lost', 'Found')),
    created_at   timestamptz not null default now()
);

alter table lost_report enable row level security;

create policy "owner or admin reads lost reports" on lost_report for select to authenticated
    using (user_id = auth.uid() or is_admin());
create policy "owner creates lost report" on lost_report for insert to authenticated
    with check (user_id = auth.uid());
create policy "owner edits lost report" on lost_report for update to authenticated
    using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owner deletes lost report" on lost_report for delete to authenticated
    using (user_id = auth.uid());


-- =====================================================================
-- 5. CLAIM  (A2 Claim Verification)  - Member A
-- =====================================================================
create table claim (
    id                 bigint generated always as identity primary key,  -- CL001
    found_item_id      bigint not null references found_item(id) on delete cascade,
    user_id            uuid   not null references user_profile(id),
    proof_description  text not null check (length(trim(proof_description)) >= 10),
    special_mark       text not null check (length(trim(special_mark)) >= 3),
    status             text not null default 'Pending'
                       check (status in ('Pending', 'Approved', 'Rejected')),
    admin_remark       text,
    created_at         timestamptz not null default now(),
    reviewed_at        timestamptz,
    unique (found_item_id, user_id)            -- one claim per item per student
);

-- Business rules the browser could skip, so the DB checks them too:
--  * new claim: item must be "Available", status always starts "Pending"
--  * student can edit only while "Pending" and cannot change status himself
create or replace function check_claim_rules()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
    if tg_op = 'INSERT' then
        if (select status from found_item where id = new.found_item_id) <> 'Available' then
            raise exception 'This item is not available for claiming.';
        end if;
        new.status := 'Pending';
    end if;

    if tg_op = 'UPDATE' and not is_admin() then
        if old.status <> 'Pending' then
            raise exception 'You can only edit a claim while it is Pending.';
        end if;
        if new.status <> old.status
           or new.admin_remark is distinct from old.admin_remark then
            raise exception 'Only admin can approve or reject a claim.';
        end if;
        if new.found_item_id <> old.found_item_id then
            raise exception 'You cannot change the item of a claim.';
        end if;
    end if;

    return new;
end;
$$;

create trigger claim_rules
    before insert or update on claim
    for each row execute function check_claim_rules();

alter table claim enable row level security;

create policy "student reads own claims, admin reads all" on claim for select to authenticated
    using (user_id = auth.uid() or is_admin());
create policy "student creates own claim" on claim for insert to authenticated
    with check (user_id = auth.uid());
create policy "student edits own claim, admin reviews" on claim for update to authenticated
    using (user_id = auth.uid() or is_admin())
    with check (user_id = auth.uid() or is_admin());
create policy "student cancels own pending claim" on claim for delete to authenticated
    using (user_id = auth.uid() and status = 'Pending');


-- =====================================================================
-- 6. NOTIFICATION  (B2)  - draft, Member B to review
-- =====================================================================
create table notification (
    id          bigint generated always as identity primary key,
    user_id     uuid references user_profile(id) on delete cascade,  -- null = announcement to all
    title       text not null check (length(trim(title)) > 0),
    message     text not null check (length(trim(message)) > 0),
    type        text not null default 'General'
                check (type in ('General', 'Match', 'Claim', 'Announcement')),
    is_read     boolean not null default false,
    created_at  timestamptz not null default now()
);

alter table notification enable row level security;

create policy "user reads own notifications" on notification for select to authenticated
    using (user_id = auth.uid() or user_id is null or is_admin());
create policy "create notification" on notification for insert to authenticated
    with check (user_id = auth.uid() or is_admin());
create policy "user updates own notifications" on notification for update to authenticated
    using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "user deletes own notifications" on notification for delete to authenticated
    using (user_id = auth.uid() or is_admin());


-- =====================================================================
-- AFTER RUNNING: create the admin account
-- =====================================================================
-- 1. Supabase > Authentication > Users > Add user > Create new user
--      Email: admin@tarc.edu.my    Password: 00000000    tick "Auto Confirm User"
-- 2. Run this to give that login an Admin profile:
insert into user_profile (id, name, student_id, email, role)
select id, 'Admin', 'ADMIN', email, 'Admin'
from auth.users
where email = 'admin@tarc.edu.my';
