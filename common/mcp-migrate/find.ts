import { existsSync, readFileSync } from "node:fs";
import type { Found, Migrator, Places, Scope, Servers } from "./migrator.ts";
import { isPlainObject } from "./server.ts";
import { errorText, parseJson } from "./text.ts";

type Read = { data?: unknown; problem?: string };

const readConfig = (path: string, parseText: (text: string) => unknown): Read => {
  if (!existsSync(path)) {
    return {};
  }

  try {
    return { data: parseText(readFileSync(path, "utf8")) };
  } catch (error) {
    return { problem: `cannot read ${path}: ${errorText(error)}` };
  }
};

export const mcpServers = (data: unknown): Servers | string => {
  if (!isPlainObject(data)) {
    return "expected a JSON object";
  }

  if (data.mcpServers === undefined) {
    return {};
  }

  return isPlainObject(data.mcpServers) ? data.mcpServers : 'expected "mcpServers" to be an object';
};

export const findServers = (migrator: Migrator, scope: Scope, places: Places): Found => {
  const specs = migrator.files(scope, places);
  const reads = specs.map((spec) => ({ spec, read: readConfig(spec.path, spec.parse ?? parseJson) }));

  const parsed = reads
    .filter(({ read }) => read.data !== undefined)
    .map(({ spec, read }) => ({ spec, servers: spec.servers(read.data) }));

  return {
    origins: parsed.flatMap(({ spec, servers }) =>
      typeof servers === "string"
        ? []
        : [
            {
              label: spec.label,
              servers,
              ...(spec.note ? { note: spec.note } : {}),
              convert: migrator.convert,
            },
          ],
    ),
    checked: specs.map((spec) => spec.label),
    problems: [
      ...reads.flatMap(({ read }) => (read.problem ? [read.problem] : [])),
      ...parsed.flatMap(({ spec, servers }) =>
        typeof servers === "string" ? [`${spec.path}: ${servers}`] : [],
      ),
    ],
  };
};
