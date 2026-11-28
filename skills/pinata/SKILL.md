---
name: pinata
description: Answers questions about pinata, the pi package already installed and loaded here; pi's own docs do not cover it. Use when the user asks how to use, configure or troubleshoot any part of it, even without naming pinata. Its extensions are subagents (background agents, /agents, /agents setup, /agents create, agent files), session-limits (handoff to a new session, /handoff), spending (session cost), context (/context), style (/style concise or normal), prune (old sessions, /prune, auto-prune), mcp-import (/mcp-import from Claude Code, Cursor or Codex), questionnaire, notifications (terminal alerts), model-default (saved model and thinking level), footer, transcript (tool rows), composer (input box), working-indicator, command-aliases (/continue, /clear, /exit). It also covers the pinata command and its sandbox (container on a Colima VM, network access, allowed and blocked hosts, credentials, config, volumes, services, extra packages in the image, corporate proxy and TLS, pinata doctor, --no-sandbox).
---

# pinata

Pinata's docs ship with it. Paths below are relative to the folder of this file.

Read only the part that covers the question and answer from it. Do not read every doc.

## An extension

`<name>` is one of the extension names in the description.

- `../../extensions/<name>/README.md`: what it does and how to use it. Start here.
- `../../extensions/<name>/ARCHITECTURE.md`: settings, config keys, defaults and exact behaviour, when the README does not answer.
- `../../extensions/<name>/STRUCTURE.md`: where its code is.

## The pinata command and its sandbox

These docs are long. List their headings first (`grep -n '^#' <file>`), then read only the matching section with an offset and a limit.

- `../../launcher/README.md`: install, everyday use, troubleshooting.
- `../../launcher/CONFIGURATION.md`: every setting, with recipes.
- `../../launcher/THREAT-MODEL.md`: what the sandbox does and does not guarantee.
- `../../launcher/ARCHITECTURE.md`: how it works.

## The package as a whole

- `../../README.md`: overview and install.
- `../../ARCHITECTURE.md` and `../../STRUCTURE.md`: how pinata is built and where things are.
