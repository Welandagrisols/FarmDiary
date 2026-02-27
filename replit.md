# Farm Diary — Potato Farm Management App

## Overview
A mobile-first farm management app for Rift Valley Potato Farm, Nakuru/Bomet/Kericho, Kenya. Built with Expo React Native, designed to replace the farm manager's physical notebook.

## Features (Phase 1)
- **Dashboard**: Section cards (A & B), growth stage, next activity urgency, budget bar
- **Schedule**: Full season activity timeline with status chips (Completed/Overdue/Due Soon/Upcoming)
- **Log Activity**: 6-step field-optimized form (activity, date/weather, products, labor, other costs, summary)
- **Costs Ledger**: Filterable by category, KES totals, expandable rows, full Add Cost form
- **Inventory**: Stock levels with low-stock alerts, usage tracking, Add Purchase form
- **Observations**: Daily field scouting log, severity levels, action tracking

## Data Storage
- All data persisted in AsyncStorage (local device storage)
- Auto-seeds farm, season, sections, and inventory on first load

## Farm Data
- **Farm**: Rift Valley Potato Farm, 4 acres, leased
- **Season**: Long Rains 2026
- **Section A**: Stephen's variety, 2 acres, planted 17 Feb 2026 (HIGH blight risk)
- **Section B**: Shangi variety, 2 acres, planted 20 Feb 2026 (MEDIUM blight risk)
- **Activities**: 13 planned activities from pre-planting through harvest (June 2026)
- **Total estimated cost**: ~KES 83,850

## Tech Stack
- **Frontend**: Expo 54 + React Native + Expo Router (file-based routing)
- **Font**: DM Sans (Google Fonts via @expo-google-fonts/dm-sans)
- **State**: FarmContext (React Context + AsyncStorage)
- **Navigation**: 5-tab bottom bar (Home, Schedule, Log, Costs, More)
- **Backend**: Express.js server (port 5000) — API only, no DB used in Phase 1

## Design System
- **Primary**: Deep green `#1B5E20`
- **Warning**: Amber `#F57F17`
- **Alert**: Red `#C62828`
- **Font**: DM Sans (400/500/600/700)
- **Cards**: 12-16px radius, subtle shadows

## Project Structure
```
app/
  _layout.tsx          # Root layout with QueryClient, FarmProvider, fonts
  (tabs)/
    _layout.tsx        # 5-tab navigation (NativeTabs/ClassicTabs)
    index.tsx          # Dashboard
    schedule.tsx       # Activity schedule
    log.tsx            # Log activity hub
    costs.tsx          # Costs ledger
    more.tsx           # More menu
  log-activity.tsx     # 6-step log form (modal)
  add-cost.tsx         # Add cost form (modal)
  inventory.tsx        # Inventory management (modal)
  observations.tsx     # Field observations (modal)

constants/
  colors.ts            # Theme colors + category colors
  farmData.ts          # PLANNED_SCHEDULE, SECTIONS_SEED, COST_CATEGORIES, INVENTORY_MASTER

context/
  FarmContext.tsx       # Shared app state, CRUD operations

lib/
  storage.ts           # AsyncStorage CRUD + utility functions
  query-client.ts      # React Query client

server/
  index.ts             # Express server
  routes.ts            # API routes (empty in Phase 1)
```

## Phase 2 (Future)
- Multi-farm switcher, season history, P&L reports, harvest revenue capture
- Database schema columns already included for future migrations

## Phase 3 (Future)
- Excel/CSV bulk import, WhatsApp quick-entry mode

## Phase 4 (Future)
- GPS farm boundary survey, satellite NDVI monitoring
