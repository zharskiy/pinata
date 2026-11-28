import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findServers } from "../find.ts";
import type { RawServer } from "../migrator.ts";
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

const fixed = { home: "/home/me", cwd: "/work", env: {} };

const convert = (raw: RawServer) => cursor.convert(raw, fixed);

describe("Cursor files", () => {
  it("reads Cursor's user and project files", () => {
    const { home, cwd, env } = places();

    writeFileSync(join(home, ".cursor", "mcp.json"), JSON.stringify({ mcpServers: { u: { command: "u" } } }));
    writeFileSync(join(cwd, ".cursor", "mcp.json"), JSON.stringify({ mcpServers: { p: { command: "p" } } }));

    expect(findServers(cursor, "user", { home, cwd, env }).origins[0].servers).toEqual({
      u: { command: "u" },
    });
    expect(findServers(cursor, "project", { home, cwd, env }).origins[0].servers).toEqual({
      p: { command: "p" },
    });
  });
});

describe("Cursor entries", () => {
  it("rewrites ${env:X} to ${X}", () => {
    expect(convert({ url: "https://x.test/mcp", headers: { Authorization: "Bearer ${env:TOKEN}" } })).toEqual(
      {
        server: { url: "https://x.test/mcp", headers: { Authorization: "Bearer ${TOKEN}" } },
        notes: ["headers.Authorization: ${env:TOKEN} became ${TOKEN}"],
      },
    );
  });

  it("rewrites ${userHome} to ~ at the start of a path and to the home directory elsewhere", () => {
    const result = convert({ command: "${userHome}/bin/srv", env: { DATA: "${userHome}/data" } });

    expect(result).toMatchObject({ server: { command: "~/bin/srv", env: { DATA: "/home/me/data" } } });
  });

  it("skips entries that use ${workspaceFolder}", () => {
    expect(convert({ command: "srv", args: ["${workspaceFolder}"] })).toEqual({
      skip: expect.stringMatching(/workspaceFolder\} in args/),
    });
  });

  it("drops envFile and auth with notes", () => {
    expect(convert({ url: "https://x.test/mcp", envFile: ".env", auth: { CLIENT_ID: "x" } })).toEqual({
      server: { url: "https://x.test/mcp" },
      notes: [
        "dropped envFile: pi does not read env files; put the variables in env or in your shell",
        "dropped auth (OAuth client settings): sign in with /mcp",
      ],
    });
  });

  it("does not apply Claude's default syntax rule", () => {
    expect(convert({ command: "srv", env: { A: "${A:-b}" } })).toMatchObject({
      server: { env: { A: "${A:-b}" } },
    });
  });
});
