import { realpathSync } from "node:fs";
import { join } from "node:path";
import { mcpServers } from "../find.ts";
import type { ConfigFile, Conversion, Migrator, Places, Scope, Server } from "../migrator.ts";
import { dropUnknown, escapeCommands, isPlainObject, mapStrings, pick, warnUnexpanded } from "../server.ts";

const CLAUDE_KEYS = [
  "type",
  "command",
  "args",
  "env",
  "cwd",
  "url",
  "headers",
  "headersHelper",
  "timeout",
  "oauth",
];

const OAUTH_KEYS = ["clientId", "callbackPort", "authServerMetadataUrl", "scope"];

const DEFAULTED = /\$\{([A-Za-z_][A-Za-z0-9_]*):-[^}]*\}/g;

const AUTHORIZATION_FROM_JSON =
  'node -e \'let s="";process.stdin.on("data",(d)=>{s+=d}).on("end",()=>{const h=JSON.parse(s);const k=Object.keys(h).find((k)=>k.toLowerCase()==="authorization");process.stdout.write(k?String(h[k]):"")})\'';

const helperCommand = (helper: string) => `!(${helper}) | ${AUTHORIZATION_FROM_JSON}`;

const convertTimeout = (raw: Server, server: Server, notes: string[]) => {
  if (raw.timeout === undefined) {
    return;
  }

  if (typeof raw.timeout !== "number" || !(raw.timeout > 0)) {
    notes.push("dropped timeout: not a positive number of milliseconds");
    return;
  }

  server.timeout = Math.ceil(raw.timeout / 1000);
  notes.push(`timeout ${raw.timeout} ms became ${server.timeout} s`);
};

const convertOAuth = (raw: Server, server: Server, notes: string[]) => {
  if (raw.oauth === undefined) {
    return;
  }

  if (!isPlainObject(raw.oauth) || !("url" in server)) {
    notes.push("dropped oauth: not an object on an HTTP server");
    return;
  }

  const oauth = raw.oauth;
  const kept = Object.fromEntries(
    OAUTH_KEYS.filter((key) => oauth[key] !== undefined).map((key) => [key, oauth[key]]),
  );
  const dropped = Object.keys(oauth).filter((key) => !OAUTH_KEYS.includes(key));

  if (Object.keys(kept).length > 0) {
    server.oauth = kept;
  }

  if (dropped.length > 0) {
    notes.push(`dropped oauth ${dropped.join(", ")}: pi has no such field`);
  }
};

const convertHelper = (raw: Server, server: Server, notes: string[]) => {
  if (raw.headersHelper === undefined) {
    return;
  }

  if (typeof raw.headersHelper !== "string" || !("url" in server)) {
    notes.push("dropped headersHelper: not a command on an HTTP server");
    return;
  }

  server.headers = {
    ...(server.headers as Record<string, string> | undefined),
    Authorization: helperCommand(raw.headersHelper),
  };
  notes.push(
    "headersHelper became an Authorization header that runs it (!command); pi keeps the output for the whole session, and other headers it prints must be added by hand",
  );
};

const convertClaude = (raw: Server): Conversion => {
  const notes: string[] = [];
  const picked = pick(raw);

  if (typeof picked === "string") {
    return { skip: picked };
  }

  mapStrings(picked, (field, value) =>
    value.replace(DEFAULTED, (_, name) => {
      notes.push(`${field}: \${${name}:-…} became \${${name}}; pi has no defaults, so set ${name}`);
      return `\${${name}}`;
    }),
  );

  escapeCommands(picked, notes);
  convertHelper(raw, picked, notes);
  convertTimeout(raw, picked, notes);
  convertOAuth(raw, picked, notes);
  warnUnexpanded(picked, notes);
  dropUnknown(raw, CLAUDE_KEYS, notes);

  return { server: picked, notes };
};

const claudeLocalServers = (data: unknown, dirs: readonly string[]): Record<string, unknown> | string => {
  if (!isPlainObject(data) || !isPlainObject(data.projects)) {
    return {};
  }

  const projects = data.projects;
  const key = dirs.find((dir) => isPlainObject(projects[dir]));

  return key === undefined ? {} : mcpServers(projects[key]);
};

const projectDirs = (cwd: string) => {
  try {
    return [...new Set([cwd, realpathSync(cwd)])];
  } catch {
    return [cwd];
  }
};

const LOCAL_NOTE =
  "comes from your private Claude local scope; .pi/mcp.json may be committed, so check it for credentials";

const files = (scope: Scope, { home, cwd }: Places): ConfigFile[] => {
  const claudeJson = join(home, ".claude.json");

  if (scope === "user") {
    return [{ label: "~/.claude.json (user scope)", path: claudeJson, servers: mcpServers }];
  }

  return [
    {
      label: "~/.claude.json (local scope of this project)",
      path: claudeJson,
      servers: (data) => claudeLocalServers(data, projectDirs(cwd)),
      note: LOCAL_NOTE,
    },
    { label: ".mcp.json", path: join(cwd, ".mcp.json"), servers: mcpServers },
  ];
};

export const claude: Migrator = {
  id: "claude",
  name: "Claude Code",
  files,
  convert: convertClaude,
};
