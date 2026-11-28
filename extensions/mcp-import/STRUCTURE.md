# MCP-import structure

```
extensions/mcp-import/
├── index.ts                 entry: re-exports the default from api/extension.ts
├── api/
│   ├── extension.ts         createManagedExtension: namespace pi-mcp-import, mcpImportPlugin
│   └── plugin.ts            mcpImportPlugin, createMcpImport: /mcp-import command, dry run, apply, interactive pick, notices
├── core/
│   ├── args.ts              argument parsing, completion, usage: the tools and usage derived from `MIGRATORS` (the scope is the shared `SettingsScope`)
│   └── import-flow.ts       pairs of every migrator × user/project: prepare a pair, survey and scan all pairs, narrow to the picked servers, write the target (a new `.pi/` gets its `.gitignore`)
├── ui/
│   ├── pick.ts              source select form and server multi-select form
│   └── report.ts            dry-run, applied, picked and nothing-to-import messages, the untrusted-project texts
├── tests/
│   ├── args.test.ts         argument parsing, completion and the usage line
│   └── mcp-import.test.ts   the command on a fake host: dry run, apply, a given Codex home, interactive pick (keys carry `shortcut`), `.pi/.gitignore`, a `.pi` that is a file
├── README.md                user guide
├── ARCHITECTURE.md          runtime behaviour
└── STRUCTURE.md             this file map
```

The readers, converters and merge are in `common/mcp-migrate/` (see the root [STRUCTURE.md](../../STRUCTURE.md)), with their tests.
