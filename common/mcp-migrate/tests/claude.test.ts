import { mkdirSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { findServers } from "../find.ts";
import type { Server } from "../migrator.ts";
import { claude } from "../migrators/claude.ts";
import { useTempDirs } from "./temp.ts";

const temp = useTempDirs();

const places = () => {
  const root = temp.make("pi-mcp-migrate-");
  const home = join(root, "home");
  const cwd = join(root, "project");

  mkdirSync(home, { recursive: true });
  mkdirSync(cwd, { recursive: true });

  return { home, cwd, env: {} };
};

const fixed = { home: "/home/me", cwd: "/work", env: {} };

const convert = (raw: Server) => claude.convert(raw, fixed);

describe("Claude Code files", () => {
  it("reads Claude's local scope under the real path of a symlinked project", () => {
    const { home, cwd, env } = places();
    const link = join(dirname(cwd), "link");

    symlinkSync(cwd, link);
    writeFileSync(
      join(home, ".claude.json"),
      JSON.stringify({ projects: { [realpathSync(cwd)]: { mcpServers: { a: { command: "x" } } } } }),
    );

    expect(findServers(claude, "project", { home, cwd: link, env }).origins[0].servers).toEqual({
      a: { command: "x" },
    });
  });

  it("finds nothing in Claude's local scope for another project", () => {
    const { home, cwd, env } = places();

    writeFileSync(
      join(home, ".claude.json"),
      JSON.stringify({ projects: { "/elsewhere": { mcpServers: { a: { command: "x" } } } } }),
    );

    expect(findServers(claude, "project", { home, cwd, env }).origins[0].servers).toEqual({});
  });

  it("reads Claude's user scope from the top level of ~/.claude.json", () => {
    const { home, cwd, env } = places();

    writeFileSync(
      join(home, ".claude.json"),
      JSON.stringify({
        mcpServers: { u: { command: "u" } },
        projects: { [cwd]: { mcpServers: { l: { command: "l" } } } },
      }),
    );

    expect(findServers(claude, "user", { home, cwd, env }).origins).toEqual([
      { label: "~/.claude.json (user scope)", servers: { u: { command: "u" } }, convert: claude.convert },
    ]);
  });

  it("reads Claude's local scope before .mcp.json for a project import", () => {
    const { home, cwd, env } = places();

    writeFileSync(
      join(home, ".claude.json"),
      JSON.stringify({ projects: { [cwd]: { mcpServers: { l: { command: "l" } } } } }),
    );
    writeFileSync(join(cwd, ".mcp.json"), JSON.stringify({ mcpServers: { p: { command: "p" } } }));

    expect(findServers(claude, "project", { home, cwd, env }).origins.map((origin) => origin.label)).toEqual([
      "~/.claude.json (local scope of this project)",
      ".mcp.json",
    ]);
  });
});

describe("Claude Code entries", () => {
  it("copies a stdio entry unchanged", () => {
    expect(convert({ type: "stdio", command: "npx", args: ["-y", "srv"], env: { A: "${A}" } })).toEqual({
      server: { type: "stdio", command: "npx", args: ["-y", "srv"], env: { A: "${A}" } },
      notes: [],
    });
  });

  it("copies an http entry with headers", () => {
    expect(
      convert({ type: "http", url: "https://x.test/mcp", headers: { Authorization: "Bearer ${T}" } }),
    ).toEqual({
      server: { type: "http", url: "https://x.test/mcp", headers: { Authorization: "Bearer ${T}" } },
      notes: [],
    });
  });

  it("skips sse and ws entries", () => {
    expect(convert({ type: "sse", url: "https://x.test/sse" })).toEqual({
      skip: expect.stringMatching(/legacy SSE/),
    });
    expect(convert({ type: "ws", url: "wss://x.test" })).toEqual({
      skip: expect.stringMatching(/WebSocket/),
    });
    expect(convert({ type: "other", command: "x" })).toEqual({ skip: expect.stringMatching(/"other"/) });
    expect(convert({ type: 7, command: "x" })).toEqual({
      skip: "has an unsupported transport type; pi supports only stdio, http and streamable-http",
    });
  });

  it("skips entries without command or url, or with malformed fields", () => {
    expect(convert({})).toEqual({ skip: expect.stringMatching(/needs "command"/) });
    expect(convert({ command: "x", args: [1] })).toEqual({ skip: expect.stringMatching(/args/) });
  });

  it("drops a default from ${VAR:-default} with a note", () => {
    const result = convert({
      url: "https://x.test/mcp",
      headers: { Authorization: "Bearer ${TOKEN:-secret-default}" },
    });

    expect(result).toEqual({
      server: { url: "https://x.test/mcp", headers: { Authorization: "Bearer ${TOKEN}" } },
      notes: ["headers.Authorization: ${TOKEN:-…} became ${TOKEN}; pi has no defaults, so set TOKEN"],
    });
    expect(JSON.stringify(result)).not.toContain("secret-default");
  });

  it("warns that pi does not expand variables outside env and headers", () => {
    const result = convert({ command: "srv", args: ["--root", "${ROOT}"] });

    expect(result).toMatchObject({ notes: [expect.stringMatching(/only in env and headers; args keep/)] });
  });

  it("converts the timeout from milliseconds to whole seconds", () => {
    expect(convert({ command: "srv", timeout: 30_500 })).toEqual({
      server: { command: "srv", timeout: 31 },
      notes: ["timeout 30500 ms became 31 s"],
    });
  });

  it("maps headersHelper to an Authorization !command", () => {
    const result = convert({ type: "http", url: "https://x.test/mcp", headersHelper: "get-headers.sh" });

    expect(result).toMatchObject({
      server: { headers: { Authorization: expect.stringMatching(/^!\(get-headers\.sh\) \| node -e /) } },
      notes: [expect.stringMatching(/^headersHelper became an Authorization header/)],
    });
  });

  it("keeps the oauth fields pi knows and drops the rest", () => {
    const result = convert({
      url: "https://x.test/mcp",
      oauth: { clientId: "id", callbackPort: 8080, other: 1 },
    });

    expect(result).toEqual({
      server: { url: "https://x.test/mcp", oauth: { clientId: "id", callbackPort: 8080 } },
      notes: ["dropped oauth other: pi has no such field"],
    });
  });

  it("keeps a literal leading ! from running as a command", () => {
    expect(convert({ command: "srv", env: { PASS: "!secret" } })).toMatchObject({
      server: { env: { PASS: "$!secret" } },
    });
  });

  it("drops unknown fields with a note", () => {
    expect(convert({ command: "srv", alwaysAllow: [] })).toEqual({
      server: { command: "srv" },
      notes: ["dropped alwaysAllow: pi has no such field"],
    });
  });
});
