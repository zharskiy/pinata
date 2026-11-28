---
name: release
description: Release this project end to end: rewrite the open release-please PR's changelog for readers, merge it and see the version through to npm. Use when the user types /release or asks to release, publish or ship a version, to merge the release PR, or to prepare or rewrite the changelog or release notes.
---

Run `git fetch origin main --tags`, then read the skill as `main` has it, `git show origin/main:.agents/skills/release/SKILL.md` (when `main` has none yet, `.agents/skills/release/SKILL.md` in the working tree), and follow it from its first step to its last. That file is the skill; this one only makes it available as `/release` on any branch. The current branch and the working tree are irrelevant to the release and stay untouched: never switch, stash, pull or commit locally. Typing `/release` is a request to release, so carry it through to the published npm package without stopping to ask, unless the arguments say otherwise (for example `/release notes only`).
