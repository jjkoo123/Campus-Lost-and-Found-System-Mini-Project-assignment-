# Member A — User / Account + Claim Verification

## Setup (once)
1. Supabase → **SQL Editor** → paste and run `database/schema.sql`.
2. Supabase → **Authentication → Providers → Email**: turn **Confirm email OFF** (so users can log in right after they register) and set **minimum password length to 8**.
3. Paste your **Project URL** and **anon key** into `assets/js/supabase.js`.
4. Open `index.html` with **Live Server**, register an account, then make it admin:
   `update user_profile set role = 'Admin' where email = 'your@email.com';`
5. For testing claims before Member C's pages exist, add one found item in SQL:
   ```sql
   insert into category(name) values ('Wallet');
   insert into location(name) values ('Library');
   insert into found_item(item_name, category_id, location_id, date_found, description)
   values ('Black wallet', 1, 1, current_date, 'Black leather wallet found near the counter');
   insert into found_item_secret values (1, 'Touch n Go card inside, Doraemon sticker on back', 'Security Office');
   ```

## My 9 functions → files
| # | Function | Page | Script |
|---|---|---|---|
| A1-C | Register | `register.html` | `modules/user/register.js` |
| A1-R | View own profile / admin user list + search | `modules/user/profile.html`, `admin-users.html` | `profile.js`, `admin-users.js` |
| A1-U | Edit profile, change password | `modules/user/profile.html` | `profile.js` |
| A1-D | Admin deactivates / reactivates user | `modules/user/admin-users.html` | `admin-users.js` |
| A2-C | Claim item with proof | `modules/claim/claim-form.html?item=ID` | `claim-form.js` |
| A2-R | My claims / admin all claims + status filter | `my-claims.html`, `admin-claims.html` | `my-claims.js`, `admin-claims.js` |
| A2-U | Edit pending claim / admin approves or rejects | `claim-form.html?id=ID`, `review.html?id=ID` | `claim-form.js`, `review.js` |
| A2-D | Cancel pending claim | `modules/claim/my-claims.html` | `my-claims.js` |
| ⭐ | Claim proof check (hidden detail vs proof, keyword hint, approve → Returned) | `modules/claim/review.html` | `review.js` |

Validation is in 2 places: JS (instant red/green messages) and DB (`CHECK`, `UNIQUE`, triggers, RLS in `schema.sql`).

## Test cases (for report and screenshots)
| ID | Test | Input | Expected |
|---|---|---|---|
| TA01 | Register, empty fields | all blank | 6 red errors listed |
| TA02 | Register, bad formats | email `abc`, ID `123`, phone `999` | format error for each |
| TA03 | Register, short password | `abc123` | "at least 8 characters" |
| TA04 | Register, passwords differ | `password1` / `password2` | "Passwords do not match" |
| TA05 | Register, duplicate email | existing email | "already registered" |
| TA06 | Register, valid | correct data | green success, redirect home |
| TA07 | Edit profile, bad phone | `123` | red error |
| TA08 | Change password, wrong old password | wrong value | "Current password is incorrect" |
| TA09 | Change password, valid | correct old + new ≥ 8 | green success |
| TA10 | Admin search, empty box | blank | "Search box cannot be empty" |
| TA11 | Admin search | `ali` | matching users only |
| TA12 | Admin deactivates user | click + confirm | user Inactive; that user cannot log in |
| TA13 | Admin row for self | — | no Deactivate button shown |
| TA14 | Claim, empty proof | blank | red errors |
| TA15 | Claim, valid | proof + mark | green success, shows Pending |
| TA16 | Claim same item twice | same item | "already claimed this item" |
| TA17 | Claim a Returned item | `?item=` of returned item | "cannot be claimed", button disabled |
| TA18 | Edit pending claim | change mark | green success |
| TA19 | Edit approved claim | open edit link | "can no longer be edited", form disabled |
| TA20 | Cancel pending claim | confirm | claim removed, green message |
| TA21 | Admin filter claims | click Approved tab | only approved claims |
| TA22 | Reject without remark | blank remark | "remark is required" |
| TA23 | Approve claim | confirm | claim Approved, item Returned, other pending claims Rejected, notification created |

## Notes for teammates
- **Member C:** `hidden_detail` and `storage_place` are in a separate admin-only table, `found_item_secret`, because RLS cannot hide a single column. On your item detail page, link students to `modules/claim/claim-form.html?item=<id>`.
- **Member B:** `review.js` inserts into `notification` (type `Claim`) on approve/reject. Please review the draft `notification` and `lost_report` tables in `schema.sql`.
- **Everyone:** add your navbar links to `NAV_LINKS` in `assets/js/layout.js`. Every page uses `<body data-root="...">` + `initLayout(role)`.
