---
name: Expo validation limits
description: Distinguish web bundle validation from the native Expo preview in this project.
---

The Expo workflow's browser root can show only the Expo Go QR landing page. A successful web bundle confirms the web target, not that the Android app or its screens bundle.

**Why:** Native bundling has encountered an incomplete installed React Native package even while web bundling succeeds.

**How to apply:** Validate the platform the user will run. Report native bundling separately when it is blocked; do not present a web bundle as Android verification.
