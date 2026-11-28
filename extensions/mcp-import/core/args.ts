import { MIGRATORS, type Migrator } from "../../../common/mcp-migrate/index.ts";
import type { SettingsScope } from "../../../platform/shared/index.ts";

const IDS = MIGRATORS.map((migrator) => migrator.id);

export type ImportArgs = { migrator: Migrator; scope: SettingsScope; apply: boolean };

const FLAGS = ["project", "apply"];

export const USAGE = `/mcp-import <${IDS.join("|")}> [project] [apply]`;

export const MISSING_SOURCE = `name the tool to import from; usage: ${USAGE}`;

export const parseArgs = (text: string): ImportArgs | { error: string } | { interactive: true } => {
  const [first, ...rest] = text.trim().split(/\s+/).filter(Boolean);

  if (!first) {
    return { interactive: true };
  }

  const migrator = MIGRATORS.find((each) => each.id === first);

  if (!migrator) {
    return { error: `unknown tool "${first}" (available: ${IDS.join(", ")}); usage: ${USAGE}` };
  }

  const unknownWords = rest.filter((word) => !FLAGS.includes(word));

  if (unknownWords.length > 0) {
    return {
      error: `unknown argument ${unknownWords.map((word) => `"${word}"`).join(", ")}; usage: ${USAGE}`,
    };
  }

  return {
    migrator,
    scope: rest.includes("project") ? "project" : "user",
    apply: rest.includes("apply"),
  };
};

export const completeArgs = (prefix: string) => {
  const words = prefix.trimStart().split(/\s+/);
  const last = words.pop() ?? "";
  const head = words.length > 0 ? `${words.join(" ")} ` : "";
  const options: string[] = words.length === 0 ? [...IDS] : FLAGS.filter((flag) => !words.includes(flag));
  const matches = options.filter((option) => option.startsWith(last));

  return matches.length > 0 ? matches.map((option) => ({ value: `${head}${option}`, label: option })) : null;
};
