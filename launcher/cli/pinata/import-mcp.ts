import { stat } from "node:fs/promises";
import { join, sep } from "node:path";
import { findServers, MIGRATORS, type Migrator, planImport } from "../../../common/mcp-migrate/index.ts";
import {
  errorMessage,
  isWithin,
  readText,
  realOrResolved,
  realOrResolvedSync,
  writeFileAtomic,
} from "../../shared/index.ts";
import { sandboxWriteRoots } from "../../workspace/index.ts";
import { type CliDeps, hostAgentDirOf } from "../deps.ts";
import { sandboxReachOf } from "../host-pi.ts";
import { withoutControls } from "../prompt/style.ts";
import { type Steps, tilde } from "../steps.ts";

const NEW_MODE = 0o600;

const modeOf = (path: string) =>
  stat(path).then(
    (info) => info.mode & 0o777,
    () => NEW_MODE,
  );

const outsideSandbox = (migrator: Migrator, roots: string[], steps: Steps): Migrator => ({
  ...migrator,
  files: (scope, places) =>
    migrator.files(scope, places).filter((file) => {
      const paths = [file.path, realOrResolvedSync(file.path)];
      const writable = roots.some((root) => paths.some((path) => isWithin(path, root)));

      if (writable) {
        steps.warn(
          `${withoutControls(file.label)} is in a folder a sandbox can write; its MCP servers were not imported`,
        );
      }

      return !writable;
    }),
});

const importServers = async (deps: CliDeps, steps: Steps) => {
  const places = { home: deps.home, cwd: deps.cwd, env: deps.env };
  const roots = await sandboxWriteRoots(await sandboxReachOf(deps));
  const found = MIGRATORS.map((migrator) =>
    findServers(outsideSandbox(migrator, roots, steps), "user", places),
  );

  found
    .flatMap((each) => each.problems)
    .forEach((problem) => {
      const shown = problem.split(`${deps.home}${sep}`).join(`~${sep}`);

      steps.warn(`${withoutControls(shown)}; its MCP servers were not imported`);
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
    steps.warn(
      `${withoutControls(plan.error)}; no MCP servers imported, fix it and run pinata install again`,
    );

    return;
  }

  if (plan.text === undefined) {
    return;
  }

  try {
    await writeFileAtomic(real, plan.text, { mode: await modeOf(real) });
  } catch (error) {
    steps.warn(
      `${label}: cannot be written (${withoutControls(errorMessage(error))}); no MCP servers imported`,
    );

    return;
  }

  const names = plan.added.map((entry) => entry.name).join(", ");
  const sources = [...new Set(plan.added.map((entry) => entry.origin))].join(", ");

  steps.done(`Imported MCP servers ${names} from ${withoutControls(sources)} into ${label}`);

  plan.added
    .flatMap((entry) => entry.notes.map((note) => `  ${entry.name}: ${withoutControls(note)}`))
    .forEach((line) => {
      steps.note(line);
    });
};

export const importMcpServers = (deps: CliDeps, steps: Steps) =>
  importServers(deps, steps).catch((error) => {
    steps.warn(`MCP import failed (${withoutControls(errorMessage(error))}); no MCP servers imported`);
  });
