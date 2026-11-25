---
name: Farm Diary API runtime
description: Node runtime requirement for the Supabase-backed API artifact.
---

The Farm Diary API server needs Node 22 or newer because the Supabase client relies on Node's built-in WebSocket.

**Why:** Under Node 20 the API service can exit before serving requests; on Node 22 the health endpoint responds successfully.

**How to apply:** Keep the Replit Node module at Node 22 when restoring or moving this API service, and verify its health endpoint after startup.
