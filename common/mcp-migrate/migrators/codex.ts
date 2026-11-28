import { join, resolve } from "node:path";
import { parse, TomlError } from "smol-toml";
import type { ConfigFile, Conversion, Migrator, PiServer, Places, RawServer, Scope } from "../migrator.ts";
import {
  dropUnknown,
  escapeCommands,
  isPlainObject,
  isStringArray,
  isStringRecord,
  mapStrings,
  pick,
} from "../server.ts";
import { homeRelative } from "../text.ts";

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const CODEX_KEYS = ["enabled", "tool_timeout_sec", "enabled_tools", "disabled_tools"];

const CODEX_STDIO_KEYS = [...CODEX_KEYS, "command", "args", "env", "cwd", "env_vars"];

const CODEX_HTTP_KEYS = [
  ...CODEX_KEYS,
  "url",
  "http_headers",
  "env_http_headers",
  "bearer_token_env_var",
  "oauth",
  "scopes",
];

const parseToml = (text: string) => {
  try {
    return parse(text);
  } catch (error) {
    if (error instanceof TomlError) {
      throw new Error(`invalid TOML at line ${error.line}, column ${error.column}`);
    }

    throw error;
  }
};

const codexServers = (data: unknown): Record<string, unknown> | string => {
  if (!isPlainObject(data) || data.mcp_servers === undefined) {
    return {};
  }

  return isPlainObject(data.mcp_servers) ? data.mcp_servers : 'expected "mcp_servers" to be a table';
};

const codexShape = (raw: RawServer): RawServer =>
  typeof raw.command === "string"
    ? { command: raw.command, args: raw.args, env: raw.env, cwd: raw.cwd }
    : { url: raw.url, headers: raw.http_headers };

const keepDollars = (server: PiServer, notes: string[]) => {
  mapStrings(server, (field, value) => {
    if (!/^(env|headers)\./.test(field) || !value.includes("$")) {
      return value;
    }

    notes.push(
      `${field} contains "$", which pi would read as a variable; written as "$$" to keep it literal`,
    );
    return value.split("$").join("$$");
  });
};

const codexHeaders = (raw: RawServer, server: PiServer, notes: string[]) => {
  const fromEnv = isStringRecord(raw.env_http_headers)
    ? Object.fromEntries(Object.entries(raw.env_http_headers).map(([name, env]) => [name, `\${${env}}`]))
    : {};
  const bearer =
    typeof raw.bearer_token_env_var === "string"
      ? { Authorization: `Bearer \${${raw.bearer_token_env_var}}` }
      : {};
  const headers = { ...(server.headers as Record<string, string> | undefined), ...fromEnv, ...bearer };

  if (raw.env_http_headers !== undefined) {
    notes.push(
      `env_http_headers became \${VAR} headers; pi fails to connect while a variable is unset, Codex left the header out`,
    );
  }

  if (Object.keys(headers).length > 0) {
    server.headers = headers;
  }
};

const codexOAuth = (raw: RawServer, server: PiServer, notes: string[]) => {
  const oauth = isPlainObject(raw.oauth) ? raw.oauth : {};
  const fields = {
    clientId: typeof oauth.client_id === "string" ? oauth.client_id : undefined,
    callbackPort: typeof oauth.callback_port === "number" ? oauth.callback_port : undefined,
    scope: isStringArray(raw.scopes) ? raw.scopes.join(" ") : undefined,
  };
  const kept = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));

  if (Object.keys(kept).length > 0) {
    server.oauth = kept;
  }

  dropUnknown(oauth, ["client_id", "callback_port"], notes, "oauth ");
};

const codexTools = (raw: RawServer, server: PiServer) => {
  const enabled = isStringArray(raw.enabled_tools)
    ? [["*", "hidden"], ...raw.enabled_tools.map((tool) => [tool, "codemode"])]
    : [];
  const disabled = isStringArray(raw.disabled_tools)
    ? raw.disabled_tools.map((tool) => [tool, "hidden"])
    : [];
  const exposures = [...enabled, ...disabled];

  if (exposures.length > 0) {
    server.toolExposure = Object.fromEntries(exposures);
  }
};

const codexOwnVariable = (raw: RawServer) =>
  Object.keys(Object(raw.env)).find((name) => name.startsWith("CODEX_"));

const convertCodex = (raw: RawServer, notes: string[]): Conversion => {
  const ownVariable = codexOwnVariable(raw);

  if (ownVariable) {
    return { skip: `is Codex's own helper: its env sets ${ownVariable}` };
  }

  const picked = pick(codexShape(raw));

  if (typeof picked === "string") {
    return { skip: picked };
  }

  keepDollars(picked, notes);
  escapeCommands(picked, notes);

  const http = "url" in picked;

  if (http) {
    codexHeaders(raw, picked, notes);
    codexOAuth(raw, picked, notes);
  }

  if (raw.enabled === false) {
    picked.enabled = false;
  }

  if (isFiniteNumber(raw.tool_timeout_sec) && raw.tool_timeout_sec > 0) {
    picked.timeout = Math.ceil(raw.tool_timeout_sec);
  }

  codexTools(raw, picked);

  if (!http && raw.env_vars !== undefined) {
    notes.push("dropped env_vars: pi passes its whole environment to stdio servers");
  }

  dropUnknown(raw, http ? CODEX_HTTP_KEYS : CODEX_STDIO_KEYS, notes);

  return { server: picked, notes };
};

const files = (scope: Scope, { home, cwd, env }: Places): ConfigFile[] => {
  const user = scope === "user";
  const path = user
    ? join(resolve(env.CODEX_HOME || join(home, ".codex")), "config.toml")
    : join(cwd, ".codex", "config.toml");

  return [
    {
      label: user ? homeRelative(path, home) : ".codex/config.toml",
      path,
      parse: parseToml,
      servers: codexServers,
    },
  ];
};

export const codex: Migrator = { id: "codex", name: "Codex", files, convert: (raw) => convertCodex(raw, []) };
