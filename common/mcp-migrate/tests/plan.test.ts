import { describe, expect, it } from "vitest";
import type { Migrator, Servers } from "../migrator.ts";
import { claude } from "../migrators/claude.ts";
import { codex } from "../migrators/codex.ts";
import { cursor } from "../migrators/cursor.ts";
import { needsSignIn, planImport } from "../plan.ts";

const places = { home: "/home/me", cwd: "/work", env: {} };

const origin = (label: string, servers: Servers, migrator: Migrator = claude) => ({
  label,
  servers,
  convert: migrator.convert,
});

const target = (text?: string) => ({ label: "mcp.json", text });

describe("import plan", () => {
  it("adds converted servers and keeps the rest of the file", () => {
    const plan = planImport(
      [origin(".mcp.json", { docs: { type: "http", url: "https://x.test/mcp" } })],
      target('{\n    "autoEnableCodemode": false,\n    "mcpServers": { "old": { "command": "old" } }\n}\n'),
      places,
    );

    expect(plan.added.map((entry) => entry.name)).toEqual(["docs"]);
    expect(JSON.parse(plan.text ?? "")).toEqual({
      autoEnableCodemode: false,
      mcpServers: { old: { command: "old" }, docs: { type: "http", url: "https://x.test/mcp" } },
    });
    expect(plan.text).toMatch(/^\{\n {4}"autoEnableCodemode"/);
  });

  it("creates the file content when there is none", () => {
    const plan = planImport([origin("a", { one: { command: "x" } }, cursor)], target(), places);

    expect(plan.text).toBe('{\n  "mcpServers": {\n    "one": {\n      "command": "x"\n    }\n  }\n}\n');
  });

  it("never overwrites an existing server, also when names differ only in - and _", () => {
    const plan = planImport(
      [origin("a", { same: { command: "new" }, "my-tool": { command: "new" } })],
      target('{"mcpServers":{"same":{"command":"old"},"my_tool":{"command":"old"}}}'),
      places,
    );

    expect(plan.added).toEqual([]);
    expect(plan.text).toBeUndefined();
    expect(plan.skipped).toEqual([
      { name: "same", origin: "a", reason: "already in mcp.json, left unchanged", present: true },
      {
        name: "my-tool",
        origin: "a",
        reason: 'pi treats it as the same server as "my_tool" in mcp.json, left unchanged',
        present: true,
      },
    ]);
  });

  it("lets the first source win for a name defined twice", () => {
    const plan = planImport(
      [origin("local", { x: { command: "local" } }), origin("project", { x: { command: "project" } })],
      target(),
      places,
    );

    expect(plan.added).toMatchObject([{ name: "x", origin: "local", server: { command: "local" } }]);
    expect(plan.skipped).toEqual([
      { name: "x", origin: "project", reason: "also defined in local, which wins" },
    ]);
  });

  it("skips invalid names and unsupported entries", () => {
    const plan = planImport(
      [origin("a", { "bad name": { command: "x" }, old: { type: "sse", url: "https://x.test/sse" } })],
      target(),
      places,
    );

    expect(plan.added).toEqual([]);
    expect(plan.skipped.map((skip) => skip.name)).toEqual(["bad name", "old"]);
  });

  it("skips a server entry that is not an object", () => {
    const plan = planImport([origin("a", { x: "x" })], target(), places);

    expect(plan.added).toEqual([]);
    expect(plan.skipped).toEqual([{ name: "x", origin: "a", reason: "is not an object" }]);
  });

  it("skips a Codex name pi cannot use next to one it adds", () => {
    const plan = planImport(
      [origin("~/.codex/config.toml", { "a.b": { command: "x" }, ok: { command: "y" } }, codex)],
      target(),
      places,
    );

    expect(plan.added.map((entry) => entry.name)).toEqual(["ok"]);
    expect(plan.skipped).toEqual([
      {
        name: "a.b",
        origin: "~/.codex/config.toml",
        reason: "pi server names use only letters, digits, _ and -",
      },
    ]);
  });

  it("refuses a target file that is not a valid mcp.json", () => {
    expect(planImport([], target("{"), places).error).toMatch(/^mcp\.json: /);
    expect(planImport([], target('{"mcpServers":[]}'), places).error).toMatch(/"mcpServers" object/);
  });

  it("reports an invalid target without quoting it", () => {
    expect(planImport([], target("{\n  secret-token\n}"), places).error).toBe(
      "mcp.json: invalid JSON at line 2, column 3",
    );
    expect(planImport([], target('{"a": secret-token}'), places).error).toBe("mcp.json: invalid JSON");
  });
});

describe("sign-in hint", () => {
  it("flags HTTP servers without an Authorization header", () => {
    expect(needsSignIn({ url: "https://x.test/mcp" })).toBe(true);
    expect(needsSignIn({ url: "https://x.test/mcp", headers: { authorization: "x" } })).toBe(false);
    expect(needsSignIn({ command: "srv" })).toBe(false);
  });
});
