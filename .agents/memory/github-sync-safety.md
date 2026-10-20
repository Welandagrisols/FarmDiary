---
name: GitHub sync safety
description: Preserve local Replit state while integrating remote app changes.
---

Before synchronizing GitHub, compare local and remote history and inspect local-only commits rather than assuming the branch is simply behind. Replit may have an agent progress snapshot, and upstream may replace or remove a local config file. Resolve ownership-sensitive configuration according to the user's choice.

**Why:** A fast-forward can be blocked by a local progress commit, and configuration conflicts can otherwise discard a deliberate local setting or keep an obsolete config.

**How to apply:** Fetch first, inspect branch divergence and local-only diffs, resolve config conflicts deliberately, and avoid resetting local history unless explicitly intended.
