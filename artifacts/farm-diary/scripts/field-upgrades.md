# Farm Diary field upgrades: database setup

Most of the field-upgrade features use the existing season and activity data and do not need a schema change:

- Crop, variety, schedule, and yield/price target are stored per season block.
- Irrigation details are saved in the activity notes.
- Existing harvest and sales records remain readable.

Two optional database changes are included:

1. `harvest-grading.sql` adds nullable Grade A, Grade B, and reject weights to `harvest_records`. Apply it only if the farm will save grade splits.
2. `buyer-commitments.sql` creates the buyer commitment table. It expects the access-control functions `public.get_farm_role(farm_id)` and `public.my_farm_ids()` to exist first.

This project checkout does not include the `sales-control.sql` script that normally provides those functions. The soil-module setup notes also depend on that script. Do not apply `buyer-commitments.sql` until the access-control functions are confirmed in the target Supabase database and the SQL has been reviewed against its schema.

No SQL in this folder was applied as part of this code change. Until the buyer table and policies are installed, the buyer-commitments screen will report that setup is missing. Until the grading columns are installed, ordinary harvest records still save, but a grade split cannot be saved.
