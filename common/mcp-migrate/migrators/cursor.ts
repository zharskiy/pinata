import { join, sep } from "node:path";
import { mcpServers } from "../find.ts";
import type { ConfigFile, Conversion, Migrator, Places, Scope, Server } from "../migrator.ts";
import { dropUnknown, escapeCommands, mapStrings, pick, strings, warnUnexpanded } from "../server.ts";

const CURSOR_KEYS = ["type", "command", "args", "env", "cwd", "url", "headers", "envFile", "auth"];

const CURSOR_ENV = /\$\{env:([A-Za-z_][A-Za-z0-9_]*)\}/g;

const WORKSPACE = /\$\{workspaceFolder(?:Basename)?\}/;

// biome-ignore lint/suspicious/noTemplateCurlyInString: Cursor's literal placeholder
const HOME = "${userHome}";

const replaceHome = (field: string, value: string, home: string) => {
  const atStart = ["command", "cwd", "args"].includes(field) && /^\$\{userHome\}(?:[/\\]|$)/.test(value);
  const rest = atStart ? `~${value.slice(HOME.length)}` : value;

  return rest.split(HOME).join(home);
};

const convertCursor = (raw: Server, places: Places): Conversion => {
  const notes: string[] = [];
  const picked = pick(raw);

  if (typeof picked === "string") {
    return { skip: picked };
  }

  const workspace = strings(picked).find(([, value]) => WORKSPACE.test(value));

  if (workspace) {
    return {
      skip: `uses \${workspaceFolder} in ${workspace[0]}, which has no pi equivalent; add it by hand with a path (pi resolves a relative cwd against the session directory)`,
    };
  }

  mapStrings(picked, (field, value) => {
    const env = value.replace(CURSOR_ENV, (whole, name) => {
      notes.push(`${field}: ${whole} became \${${name}}`);
      return `\${${name}}`;
    });

    const home = env.includes(HOME) ? replaceHome(field, env, places.home) : env;

    if (home !== env) {
      notes.push(`${field}: \${userHome} became ${home.startsWith("~") ? "~" : "the home directory"}`);
    }

    return home.replace(/\$\{(?:pathSeparator|\/)\}/g, sep);
  });

  escapeCommands(picked, notes);

  if (raw.envFile !== undefined) {
    notes.push("dropped envFile: pi does not read env files; put the variables in env or in your shell");
  }

  if (raw.auth !== undefined) {
    notes.push("dropped auth (OAuth client settings): sign in with /mcp");
  }

  warnUnexpanded(picked, notes);
  dropUnknown(raw, CURSOR_KEYS, notes);

  return { server: picked, notes };
};

const files = (scope: Scope, { home, cwd }: Places): ConfigFile[] =>
  scope === "user"
    ? [{ label: "~/.cursor/mcp.json", path: join(home, ".cursor", "mcp.json"), servers: mcpServers }]
    : [{ label: ".cursor/mcp.json", path: join(cwd, ".cursor", "mcp.json"), servers: mcpServers }];

export const cursor: Migrator = {
  id: "cursor",
  name: "Cursor",
  files,
  convert: convertCursor,
};
