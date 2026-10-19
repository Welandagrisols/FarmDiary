---
name: Expo validation limits
description: Distinguish web bundle validation from the native Expo preview in this project.
---

For interactive browser testing, the visible preview must target the Expo frontend on port 8081; the backend on port 5000 is not the app UI. A successful web bundle confirms the web target, not that the Android app or its screens bundle.

**Why:** The backend preview displayed its own landing page while the Expo frontend was only a console workflow. Native bundling has also encountered an incomplete installed React Native package even while web bundling succeeds.

**How to apply:** Attach the browser preview to the Expo frontend, then validate the platform the user will run. Report native bundling separately when it is blocked; do not present a web bundle as Android verification.
