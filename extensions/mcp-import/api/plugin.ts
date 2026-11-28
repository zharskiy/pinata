import { homedir } from "node:os";
import { MIGRATORS, type Migrator } from "../../../common/mcp-migrate/index.ts";
import type { Host } from "../../../platform/pi-adapter/index.ts";
import type { Plugin, SettingsScope } from "../../../platform/shared/index.ts";
import { completeArgs, type ImportArgs, MISSING_SOURCE, parseArgs, USAGE } from "../core/args.ts";
import { type Pair, prepareImport, selectedPlan, surveyImports, writeImport } from "../core/import-flow.ts";
import { pickImport } from "../ui/pick.ts";
import {
  appliedReport,
  dryRunReport,
  emptyReport,
  NAMESPACE,
  NOTHING_SELECTED,
  nothingToImport,
  pickedReport,
  UNTRUSTED,
  UNTRUSTED_ONLY,
} from "../ui/report.ts";

const NAMES = MIGRATORS.map((migrator) => migrator.name);

export const createMcpImport = (host: Host, home: string, env: NodeJS.ProcessEnv) => {
  const notify = (message: string) => {
    host.ui.notify(message, "info");
  };

  const fail = (message: string, level: "warning" | "error" = "error") => {
    host.ui.notify(`${NAMESPACE}: ${message}`, level);
  };

  const places = () => {
    const { cwd, agentDir } = host.session();

    return { home, cwd, agentDir, env };
  };

  const prepare = (migrator: Migrator, scope: SettingsScope) => prepareImport(migrator, scope, places());

  const write = (pair: Pair, text: string | undefined) => {
    const problem = writeImport(pair, text, places());

    if (problem) {
      fail(problem);
      return false;
    }

    return true;
  };

  const run = (args: ImportArgs) => {
    const project = args.scope === "project";

    if (project && args.apply && !host.session().projectTrusted) {
      fail(UNTRUSTED);
      return;
    }

    const { found, pair, problem } = prepare(args.migrator, args.scope);

    found.problems.forEach((message) => {
      fail(message, "warning");
    });

    if (problem) {
      fail(problem);
      return;
    }

    if (!pair) {
      notify(emptyReport(args, found.checked));
      return;
    }

    const report = { args, plan: pair.plan, checked: found.checked, target: pair.target };

    if (!args.apply) {
      notify(dryRunReport(report));
      return;
    }

    if (write(pair, pair.plan.text)) {
      notify(appliedReport(report));
    }
  };

  const apply = (picked: Pair, names: readonly string[]) => {
    const fresh = prepare(picked.migrator, picked.scope);

    if (fresh.problem) {
      fail(fresh.problem);
      return;
    }

    const pair = fresh.pair;

    if (!pair) {
      fail(`found no MCP servers in ${fresh.found.checked.join(", ")} any more, nothing written`);
      return;
    }

    const { plan, problem } = selectedPlan(pair, names, places());

    if (problem) {
      fail(problem);
      return;
    }

    if (!write(pair, plan.text)) {
      return;
    }

    const args = { migrator: pair.migrator, scope: pair.scope, apply: true };

    notify(pickedReport({ args, plan, checked: pair.found.checked, target: pair.target }));
  };

  const interactive = async () => {
    const { warnings, problems, checked, scan } = surveyImports(places(), host.session().projectTrusted);

    warnings.forEach((message) => {
      fail(message, "warning");
    });
    problems.forEach((message) => {
      fail(message);
    });

    if (scan.kind === "untrusted") {
      fail(UNTRUSTED_ONLY);
      return;
    }

    if (scan.kind === "empty") {
      if (problems.length === 0) {
        notify(nothingToImport(checked, scan));
      }

      return;
    }

    const picked = await pickImport(host, scan.pairs);

    if (!picked) {
      return;
    }

    if (picked.names.length === 0) {
      notify(NOTHING_SELECTED);
      return;
    }

    apply(picked.pair, picked.names);
  };

  host.registerCommand("mcp-import", {
    description: `Import MCP servers from ${NAMES.slice(0, -1).join(", ")} or ${NAMES.at(-1)} into pi's mcp.json; without arguments pick the source and servers, with arguments a dry run unless you add apply: ${USAGE}`,
    complete: completeArgs,
    run: async (text) => {
      const args = parseArgs(text);

      if ("error" in args) {
        fail(args.error);
        return;
      }

      if ("interactive" in args) {
        if (host.session().mode !== "tui") {
          fail(MISSING_SOURCE);
          return;
        }

        await interactive();
        return;
      }

      run(args);
    },
  });
};

export const mcpImportPlugin: Plugin<never, never, undefined> = {
  id: "mcp-import",
  enable({ host }) {
    createMcpImport(host, homedir(), process.env);
  },
};
