---
name: GitHub sync safety
description: Preserve local app history and identity when adopting upstream changes.
---

Before synchronizing, compare local and remote histories and preserve the local branch before switching a reorganized project layout. When adopting upstream Expo configuration, keep the existing iOS and Android identifiers and EAS project unless the user explicitly requests an identity change.

**Why:** Upstream branches can move the app into a new artifact structure and may carry different package identifiers or an EAS project owned by another account.

**How to apply:** Inspect the local app config and the remote artifact config before switching. Keep a recovery branch and carry forward the existing identifiers.
