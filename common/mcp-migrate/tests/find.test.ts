import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findServers } from "../find.ts";
import { cursor } from "../migrators/cursor.ts";
import { useTempDirs } from "./temp.ts";

const temp = useTempDirs();

const places = () => {
  const root = temp.make("pi-mcp-migrate-");
  const home = join(root, "home");
  const cwd = join(root, "project");

  mkdirSync(join(home, ".cursor"), { recursive: true });
  mkdirSync(join(cwd, ".cursor"), { recursive: true });

  return { home, cwd, env: {} };
};

describe("source files", () => {
  it("reports a wrong mcpServers shape as a problem", () => {
    const { home, cwd, env } = places();

    writeFileSync(join(cwd, ".cursor", "mcp.json"), JSON.stringify({ mcpServers: [] }));

    const found = findServers(cursor, "project", { home, cwd, env });

    expect(found.origins).toEqual([]);
    expect(found.problems).toEqual([expect.stringMatching(/"mcpServers"/)]);
  });

  it("treats missing files as empty and reports unreadable ones", () => {
    const { home, cwd, env } = places();

    expect(findServers(cursor, "user", { home, cwd, env })).toEqual({
      origins: [],
      checked: ["~/.cursor/mcp.json"],
      problems: [],
    });

    writeFileSync(join(home, ".cursor", "mcp.json"), "{");

    expect(findServers(cursor, "user", { home, cwd, env }).problems).toEqual([
      expect.stringMatching(/^cannot read .*mcp\.json: /),
    ]);
  });
});
