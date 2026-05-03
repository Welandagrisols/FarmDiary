# Farm Diary — Multi-Farm Management App

## Overview
A mobile-first farm management app supporting multiple farms. Built with Expo React Native, designed to replace the farm manager's physical notebook. The active farm gates all data — switching farms instantly updates every screen.

## Features
- **Multi-Farm**: Create unlimited farms, switch active farm from More tab → "My Farms"
- **Farm Setup**: Create/edit form — name, location, acres, ownership, crop type, notes
- **Farm Switcher**: List all farms, stats per farm, one-tap switch with confirmation
- **Dashboard**: Section cards (A & B), growth stage, next activity urgency, budget bar, active season header
- **Schedule**: Full season activity timeline driven by `currentSchedule` from FarmContext
- **Log Activity**: 6-step field-optimized form — uses `activeSeason` from context for season ID and planting date
- **Costs Ledger**: Filterable by category, KES totals, season-scoped and farm-scoped
- **Inventory**: Stock levels with low-stock alerts, usage tracking, farm-scoped
- **Observations**: Daily field scouting log, severity levels, farm-scoped
- **Harvest Records**: Bags/weight/price/revenue, farm-scoped
- **Export**: CSV/JSON data export, uses active farm ID on import
- **Season Control**: View all seasons for active farm, close/switch seasons
- **Season Setup**: 5-step new season wizard — variety → planting date → schedule preview → confirm

## Multi-Farm Architecture
- `FarmRecord` interface in `lib/storage.ts` with full CRUD (`getFarms`, `getActiveFarmRecord`, `addFarmRecord`, `updateFarmRecord`, `setActiveFarmId`)
- `FarmContext.tsx` exposes: `farms`, `activeFarm`, `farmId`, `createFarm`, `switchFarm`, `updateActiveFarm`
- On `switchFarm()`: sets active farm in AsyncStorage, reloads all data arrays filtered by new `farm_id`
- All data (costs, inventory, logs, observations, harvest, seasons) filtered by `activeFarm.id` in context
- Every record-creation call uses `farmId` from `useFarm()` — never hardcoded
- Default farm (Rift Valley Potato Farm, `farm-001`) seeded in `seedIfNeeded()` if no farms exist

## Season Architecture
- `SeasonRecord` interface in `lib/storage.ts` with full CRUD
- `FarmContext.tsx` exposes: `activeSeason`, `currentSchedule`, `seasons` (all filtered by activeFarm.id)
- `currentSchedule` computed from `generatePlannedSchedule()` using active season's planting date
- Backward-compat: Season-001 seeded via `seedSeasonIfNeeded()` on first load

## Data Storage
- All data persisted in AsyncStorage (local device storage)
- Keys: `farm_farms`, `farm_active_farm_id`, `farm_seasons`, `farm_active_season_id`, `farm_costs`, `farm_inventory`, `farm_activity_logs`, `farm_observations`, `farm_harvest`
- Auto-seeds default farm, season, inventory on first load

## Tech Stack
- **Frontend**: Expo 54 + React Native + Expo Router (file-based routing)
- **Font**: DM Sans (Google Fonts via @expo-google-fonts/dm-sans)
- **State**: FarmContext (React Context + AsyncStorage)
- **Navigation**: 5-tab bottom bar (Home, Schedule, Log, Costs, More)
- **Backend**: Express.js server (port 5000) — API only

## Design System
- **Primary**: Deep green `#1B5E20`
- **Warning**: Amber `#F57F17`
- **Alert**: Red `#C62828`
- **Font**: DM Sans (400/500/600/700)
- **Icons**: Ionicons ONLY (never MaterialCommunityIcons)
- **Cards**: 12-16px radius, subtle shadows

## Project Structure
```
app/
  _layout.tsx           # Root layout — registers ALL screens
  (tabs)/
    _layout.tsx         # 5-tab navigation
    index.tsx           # Dashboard (uses activeSeason + currentSchedule)
    schedule.tsx        # Schedule (uses currentSchedule from context)
    log.tsx             # Log activity hub
    costs.tsx           # Costs ledger
    more.tsx            # More menu → Season Control, Inventory, etc.
  log-activity.tsx      # 6-step log form (uses activeSeason)
  add-cost.tsx          # Add cost form (uses activeSeason)
  add-harvest.tsx       # Harvest entry (uses activeSeason)
  inventory.tsx         # Inventory management (uses activeSeason)
  observations.tsx      # Field observations (uses activeSeason)
  harvest.tsx           # Harvest records list
  export.tsx            # CSV/JSON export
  all-logs.tsx          # Full activity log list
  cost-breakdown.tsx    # Cost breakdown detail
  edit-activity.tsx     # Edit activity log
  season-control.tsx    # Season overview + close + switch
  season-setup.tsx      # New season wizard (4 steps)

constants/
  colors.ts             # Theme colors + category colors
  farmData.ts           # CropTemplate, generatePlannedSchedule(), COST_CATEGORIES

context/
  FarmContext.tsx        # Shared state: activeSeason, currentSchedule, CRUD

lib/
  storage.ts            # AsyncStorage CRUD + SeasonRecord interface + utilities
  query-client.ts       # React Query client

server/
  index.ts              # Express server
```
