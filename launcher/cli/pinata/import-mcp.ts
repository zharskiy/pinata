import { stat } from "node:fs/promises";
import { join } from "node:path";
import { findServers, MIGRATORS, planImport } from "../../../common/mcp-migrate/index.ts";
import { errorMessage, readText, realOrResolved, writeFileAtomic } from "../../shared/index.ts";
import { type CliDeps, hostAgentDirOf } from "../deps.ts";
import { type Steps, tilde } from "../steps.ts";

const NEW_MODE = 0o600;

const modeOf = (path: string) =>
  stat(path).then(
    (info) => info.mode & 0o777,
    () => NEW_MODE,
  );

export const importMcpServers = async (deps: CliDeps, steps: Steps) => {
  const places = { home: deps.home, cwd: deps.cwd, env: deps.env };
  const found = MIGRATORS.map((migrator) => findServers(migrator, "user", places));

  found
    .flatMap((each) => each.problems)
    .forEach((problem) => {
      steps.warn(`${problem}; its MCP servers were not imported`);
    });

  const origins = found.flatMap((each) => each.origins);

  if (!origins.some((origin) => Object.keys(origin.servers).length > 0)) {
    return;
  }

  const file = join(hostAgentDirOf(deps), "mcp.json");
  const label = tilde(deps, file);
  const real = await realOrResolved(file);
  const text = await readText(real).catch(() => null);

  if (text === null) {
    steps.warn(`${label}: cannot be read; no MCP servers imported`);

    return;
  }

  const plan = planImport(origins, { label, text }, places);

  if (plan.error) {
    steps.warn(`${plan.error}; no MCP servers imported, fix it and run pinata install again`);

    return;
  }

  if (plan.text === undefined) {
    return;
  }

  try {
    await writeFileAtomic(real, plan.text, { mode: await modeOf(real) });
  } catch (error) {
    steps.warn(
      `${label}: cannot be written (${errorMessage(error).replace(`${real}: `, "")}); no MCP servers imported`,
    );

    return;
  }

  const names = plan.added.map((entry) => entry.name).join(", ");
  const sources = [...new Set(plan.added.map((entry) => entry.origin))].join(", ");

  steps.done(`Imported MCP servers ${names} from ${sources} into ${label}`);

  plan.added
    .flatMap((entry) => entry.notes.map((note) => `  ${entry.name}: ${note}`))
    .forEach((line) => {
      steps.note(line);
    });
};
