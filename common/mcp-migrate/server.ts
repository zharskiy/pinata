import type { PiServer, RawServer } from "./migrator.ts";

export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

const PI_TYPES = ["stdio", "http", "streamable-http"];

const LITERAL_FIELDS = ["command", "cwd", "url"];

const VARIABLE = /\$\{[^}]*\}/;

export const isStringRecord = (value: unknown): value is Record<string, string> =>
  isPlainObject(value) && Object.values(value).every((item) => typeof item === "string");

const transportSkip = (type: unknown) => {
  if (type === "sse") {
    return "uses the legacy SSE transport, which pi does not support; use the server's streamable HTTP URL (often /mcp instead of /sse)";
  }

  if (type === "ws") {
    return "uses the WebSocket transport, which pi does not support";
  }

  const named =
    typeof type === "string" ? `transport type ${JSON.stringify(type)}` : "an unsupported transport type";

  return `has ${named}; pi supports only stdio, http and streamable-http`;
};

export const pick = (raw: RawServer): PiServer | string => {
  if (raw.type !== undefined && !PI_TYPES.includes(raw.type as string)) {
    return transportSkip(raw.type);
  }

  const out: PiServer = {};

  if (raw.type !== undefined) {
    out.type = raw.type;
  }

  if (typeof raw.command === "string" && (raw.type === undefined || raw.type === "stdio")) {
    out.command = raw.command;

    if (raw.args !== undefined) {
      if (!isStringArray(raw.args)) {
        return "has args that are not a list of strings";
      }

      out.args = raw.args;
    }

    if (raw.env !== undefined) {
      if (!isStringRecord(raw.env)) {
        return "has env values that are not strings";
      }

      out.env = { ...raw.env };
    }

    if (typeof raw.cwd === "string") {
      out.cwd = raw.cwd;
    }

    return out;
  }

  if (typeof raw.url === "string" && raw.type !== "stdio") {
    out.url = raw.url;

    if (raw.headers !== undefined) {
      if (!isStringRecord(raw.headers)) {
        return "has header values that are not strings";
      }

      out.headers = { ...raw.headers };
    }

    return out;
  }

  return 'needs "command" (stdio) or "url" (streamable HTTP)';
};

export const mapStrings = (server: PiServer, map: (field: string, value: string) => string) => {
  LITERAL_FIELDS.filter((field) => typeof server[field] === "string").forEach((field) => {
    server[field] = map(field, server[field] as string);
  });

  if (isStringArray(server.args)) {
    server.args = server.args.map((arg) => map("args", arg));
  }

  ["env", "headers"]
    .filter((field) => isStringRecord(server[field]))
    .forEach((field) => {
      const values = server[field] as Record<string, string>;

      server[field] = Object.fromEntries(
        Object.entries(values).map(([key, value]) => [key, map(`${field}.${key}`, value)]),
      );
    });
};

export const strings = (server: PiServer): [string, string][] => [
  ...LITERAL_FIELDS.filter((field) => typeof server[field] === "string").map((field): [string, string] => [
    field,
    server[field] as string,
  ]),
  ...(isStringArray(server.args) ? server.args.map((arg): [string, string] => ["args", arg]) : []),
  ...["env", "headers"].flatMap((field) =>
    isStringRecord(server[field])
      ? Object.entries(server[field] as Record<string, string>).map(([key, value]): [string, string] => [
          `${field}.${key}`,
          value,
        ])
      : [],
  ),
];

export const escapeCommands = (server: PiServer, notes: string[]) => {
  mapStrings(server, (field, value) => {
    if (!/^(env|headers)\./.test(field) || !value.startsWith("!")) {
      return value;
    }

    notes.push(
      `${field} starts with "!", which pi would run as a command; written as "$!..." to keep it literal`,
    );
    return `$${value}`;
  });
};

export const warnUnexpanded = (server: PiServer, notes: string[]) => {
  const fields = [
    ...new Set(
      strings(server)
        .filter(([field, value]) => !/^(env|headers)\./.test(field) && VARIABLE.test(value))
        .map(([field]) => field),
    ),
  ];

  if (fields.length > 0) {
    notes.push(
      `pi expands variables only in env and headers; ${fields.join(", ")} keep their \${...} text as written`,
    );
  }
};

export const dropUnknown = (raw: RawServer, known: string[], notes: string[], prefix = "") => {
  const unknownKeys = Object.keys(raw).filter((key) => !known.includes(key));

  if (unknownKeys.length > 0) {
    notes.push(`dropped ${prefix}${unknownKeys.join(", ")}: pi has no such field`);
  }
};
