# Farm Diary — Potato Farm Management App

## Overview
A mobile-first farm management app for Rift Valley Potato Farm, Nakuru/Bomet/Kericho, Kenya. Built with Expo React Native, designed to replace the farm manager's physical notebook.

## Features
- **Dashboard**: Section cards (A & B), growth stage, next activity urgency, budget bar, active season header
- **Schedule**: Full season activity timeline driven by `currentSchedule` from FarmContext
- **Log Activity**: 6-step field-optimized form — uses `activeSeason` from context for season ID and planting date
- **Costs Ledger**: Filterable by category, KES totals, season-scoped
- **Inventory**: Stock levels with low-stock alerts, usage tracking, season-scoped
- **Observations**: Daily field scouting log, severity levels, season-scoped
- **Harvest Records**: Bags/weight/price/revenue, season-scoped
- **Export**: CSV/JSON data export
- **Season Control**: View all seasons, close active season, switch season
- **Season Setup**: 4-step new season wizard — variety → planting date → schedule preview → confirm

## Season Architecture
- `SeasonRecord` interface in `lib/storage.ts` with full CRUD (`getSeasons`, `getActiveSeason`, `addSeason`, `updateSeason`, `closeSeason`, etc.)
- `FarmContext.tsx` exposes: `activeSeason`, `currentSchedule` (generated from planting date via crop templates), `seasons`, `createSeason`, `switchSeason`, `closeActiveSeason`
- `currentSchedule` is computed from `generatePlannedSchedule()` in `constants/farmData.ts` using the active season's planting date — never hardcoded
- All cost/activity/inventory/observation saves use `activeSeason?.id || SEASON_SEED.id` fallback
- Backward-compat: Season-001 seeded via `seedSeasonIfNeeded()` on first load

## Data Storage
- All data persisted in AsyncStorage (local device storage)
- Auto-seeds farm, season, sections on first load

## Farm Data
- **Farm**: Rift Valley Potato Farm, 4 acres, leased
- **Section A**: Stephen's variety, 2 acres (HIGH blight risk)
- **Section B**: Shangi variety, 2 acres (MEDIUM blight risk)
- **Activities**: Generated dynamically from `CropTemplate` day-offset rules applied to planting date
- **Total estimated cost**: ~KES 83,850

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
