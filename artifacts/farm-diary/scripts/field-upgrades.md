# Farm Diary field upgrades: database setup

Most of the field-upgrade features use the existing season and activity data and do not need a schema change:

- Crop, variety, schedule, and yield/price target are stored per season block.
- Irrigation details are saved in the activity notes.
- Existing harvest and sales records remain readable.

Two optional database changes are included:

1. `harvest-grading.sql` adds nullable Grade A, Grade B, and reject weights to `harvest_records`. Apply it only if the farm will save grade splits.
2. `buyer-commitments.sql` creates the buyer commitment table. It expects the access-control functions `public.get_farm_role(farm_id)` and `public.my_farm_ids()` to exist first.
3. `labour-cost-permissions.sql` adds database triggers so only admins, owners, and managers can create or change labour cost records. Confirm `public.get_farm_role(p_farm_id)` and the activity/cost columns exist, then apply this script manually to Supabase.
4. `sales-cashier-permissions.sql` adds the cashier farm role and lets cashiers confirm another team member's sale. It preserves the different-person check, keeps discount/void approvals restricted, and updates sales access policies. This migration is applied separately from Replit Publish.

This project checkout does not include the `sales-control.sql` script that normally provides those functions. The soil-module setup notes also depend on that script. Do not apply `buyer-commitments.sql` until the access-control functions are confirmed in the target Supabase database and the SQL has been reviewed against its schema.

No SQL in this folder was applied as part of this code change. Until the buyer table and policies are installed, the buyer-commitments screen will report that setup is missing. Until the grading columns are installed, ordinary harvest records still save, but a grade split cannot be saved. Until `labour-cost-permissions.sql` is applied, normal app screens enforce manager access, but direct database writes and queued offline writes are not covered by the database guard.
