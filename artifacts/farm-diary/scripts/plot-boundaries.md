# Plot boundary setup

The app records ordered GPS points (`[longitude, latitude]`), calculates an estimated area and perimeter, and can keep a pending measurement on the device until it can sync.

The SQL migration is **not applied** by this change. Before running `plot-boundaries.sql` in Supabase:

1. Confirm the farm and plot tables are installed.
2. Apply the soil-module schema first.
3. Confirm `public.get_farm_role(farm_id)` and the plot row-level security policies exist. The current GitHub artifact does not include the `sales-control.sql` file that the soil module expects.
4. Review the migration against the live schema, then apply it only after approval.

Once the migration exists, pending phone measurements can upload when the user next opens Plots with a connection. Until then, the outline is labelled as saved on that phone and is not available to other farm users.

Phone GPS can be several metres off. The displayed area is an estimate for farm planning, not a legal survey.
