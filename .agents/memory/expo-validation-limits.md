---
name: Expo validation limits
description: Distinguish web bundle validation from the native Expo preview in this project.
---

For interactive browser testing in this Replit Expo project, expose the app through the webview on port 5000 and proxy non-API requests to Metro on port 8081. Keep the Metro workflow as a console; do not expose 8081 as the public preview. A web bundle still does not verify Android.

**Why:** Direct mobile-browser access to the public `:8081` link aborted, while the 5000 proxy successfully rendered the Farm Diary sign-in screen. Native bundling has separately encountered an incomplete installed React Native package.

**How to apply:** Keep `/api` routed to Express and proxy browser app traffic through 5000 to Metro; validate Android separately and report it as unverified if native bundling is blocked.
