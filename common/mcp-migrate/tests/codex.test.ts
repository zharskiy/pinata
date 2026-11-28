import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { findServers } from "../find.ts";
import type { RawServer } from "../migrator.ts";
import { claude } from "../migrators/claude.ts";
import { codex } from "../migrators/codex.ts";
import { useTempDirs } from "./temp.ts";

const temp = useTempDirs();

const places = () => {
  const root = temp.make("pi-mcp-migrate-");
  const home = join(root, "home");
  const cwd = join(root, "project");

  mkdirSync(home, { recursive: true });
  mkdirSync(cwd, { recursive: true });

  return { home, cwd, env: {}, codexHome: join(home, ".codex") };
};

const fixed = { home: "/home/me", cwd: "/work", env: {} };

const convert = (raw: RawServer) => codex.convert(raw, fixed);

describe("Codex files", () => {
  it("reads Codex's user file with quoted names, multi-line arrays and nested tables", () => {
    const { home, cwd, env, codexHome } = places();

    mkdirSync(codexHome);
    writeFileSync(
      join(codexHome, "config.toml"),
      [
        'model = "x"',
        '[mcp_servers."a.b"]',
        'command = "npx"',
        "args = [",
        '  "-y",',
        "]",
        "[mcp_servers.docs]",
        'url = "https://x.test/mcp"',
        'http_headers = { "X-Client" = "pinata" }',
        "[mcp_servers.docs.oauth]",
        'client_id = "id"',
      ].join("\n"),
    );

    expect(findServers(codex, "user", { home, cwd, env }).origins).toEqual([
      {
        label: "~/.codex/config.toml",
        servers: {
          "a.b": { command: "npx", args: ["-y"] },
          docs: {
            url: "https://x.test/mcp",
            http_headers: { "X-Client": "pinata" },
            oauth: { client_id: "id" },
          },
        },
        convert: codex.convert,
      },
    ]);
  });

  it("names a CODEX_HOME outside the home folder by its full path", () => {
    const { home, cwd } = places();
    const codexHome = join(dirname(home), "codex");

    expect(findServers(codex, "user", { home, cwd, env: { CODEX_HOME: codexHome } }).checked).toEqual([
      join(codexHome, "config.toml"),
    ]);
  });

  it("reads Codex's project file from the working directory only", () => {
    const { home, cwd, env } = places();
    const inner = join(cwd, "inner");

    mkdirSync(join(inner, ".codex"), { recursive: true });
    mkdirSync(join(cwd, ".codex"));
    writeFileSync(join(cwd, ".codex", "config.toml"), '[mcp_servers.outer]\ncommand = "o"\n');
    writeFileSync(join(inner, ".codex", "config.toml"), '[mcp_servers.inner]\ncommand = "i"\n');

    expect(findServers(codex, "project", { home, cwd: inner, env }).origins).toEqual([
      { label: ".codex/config.toml", servers: { inner: { command: "i" } }, convert: codex.convert },
    ]);
  });

  it("reports bad TOML by line and column without quoting the file", () => {
    const { home, cwd, env, codexHome } = places();

    mkdirSync(codexHome);
    writeFileSync(join(codexHome, "config.toml"), '[mcp_servers.a]\nenv = { TOKEN = "secret" }\nx = = 1\n');

    const [problem] = findServers(codex, "user", { home, cwd, env }).problems;

    expect(problem).toMatch(/^cannot read .*config\.toml: invalid TOML at line 3, column \d+$/);
    expect(problem).not.toContain("secret");
  });

  it("reports an mcp_servers that is not a table and reads a file without one as empty", () => {
    const { home, cwd, env, codexHome } = places();

    mkdirSync(codexHome);
    writeFileSync(join(codexHome, "config.toml"), "mcp_servers = 1\n");

    expect(findServers(codex, "user", { home, cwd, env }).problems).toEqual([
      expect.stringMatching(/"mcp_servers"/),
    ]);

    writeFileSync(join(codexHome, "config.toml"), 'model = "x"\n');

    expect(findServers(codex, "user", { home, cwd, env }).origins).toEqual([
      { label: "~/.codex/config.toml", servers: {}, convert: codex.convert },
    ]);
  });
});

describe("Codex entries", () => {
  it("copies a stdio entry", () => {
    expect(convert({ command: "npx", args: ["-y", "srv"], cwd: "/work", env: { A: "b" } })).toEqual({
      server: { command: "npx", args: ["-y", "srv"], cwd: "/work", env: { A: "b" } },
      notes: [],
    });
  });

  it("builds the headers from http_headers, env_http_headers and bearer_token_env_var, later ones winning", () => {
    const result = convert({
      url: "https://x.test/mcp",
      http_headers: { "X-Client": "pinata", Authorization: "Basic x" },
      env_http_headers: { "X-Api-Key": "API_KEY", "X-Client": "CLIENT" },
      bearer_token_env_var: "TOKEN",
    });

    expect(result).toEqual({
      server: {
        url: "https://x.test/mcp",
        headers: { "X-Client": "${CLIENT}", Authorization: "Bearer ${TOKEN}", "X-Api-Key": "${API_KEY}" },
      },
      notes: [
        "env_http_headers became ${VAR} headers; pi fails to connect while a variable is unset, Codex left the header out",
      ],
    });
  });

  it("keeps literal $ and a leading ! in env and header values", () => {
    expect(convert({ command: "srv", env: { PASS: "!a$b", PATHS: "${X}" } })).toEqual({
      server: { command: "srv", env: { PASS: "$!a$$b", PATHS: "$${X}" } },
      notes: [
        'env.PASS contains "$", which pi would read as a variable; written as "$$" to keep it literal',
        'env.PATHS contains "$", which pi would read as a variable; written as "$$" to keep it literal',
        'env.PASS starts with "!", which pi would run as a command; written as "$!..." to keep it literal',
      ],
    });
    expect(convert({ url: "https://x.test/mcp", http_headers: { X: "a$b" } })).toMatchObject({
      server: { headers: { X: "a$$b" } },
    });
    expect(convert({ command: "$srv", args: ["$A"] })).toEqual({
      server: { command: "$srv", args: ["$A"] },
      notes: [],
    });
    expect(convert({ url: "https://x.test/$mcp" })).toEqual({
      server: { url: "https://x.test/$mcp" },
      notes: [],
    });
  });

  it("copies enabled = false and the tool timeout in whole seconds", () => {
    expect(convert({ command: "srv", enabled: false, tool_timeout_sec: 90.5 })).toEqual({
      server: { command: "srv", enabled: false, timeout: 91 },
      notes: [],
    });
    expect(convert({ command: "srv", enabled: true })).toEqual({ server: { command: "srv" }, notes: [] });
  });

  it("hides every tool but enabled_tools, then hides disabled_tools", () => {
    expect(convert({ command: "srv", enabled_tools: ["a", "b"], disabled_tools: ["b"] })).toMatchObject({
      server: { toolExposure: { "*": "hidden", a: "codemode", b: "hidden" } },
    });
    expect(convert({ command: "srv", disabled_tools: ["c"] })).toMatchObject({
      server: { toolExposure: { c: "hidden" } },
    });
  });

  it("keeps the OAuth client id, callback port and scopes and drops the other OAuth keys", () => {
    const result = convert({
      url: "https://x.test/mcp",
      scopes: ["read", "write"],
      oauth: { client_id: "id", callback_port: 8765, client_secret: "s" },
    });

    expect(result).toEqual({
      server: {
        url: "https://x.test/mcp",
        oauth: { clientId: "id", callbackPort: 8765, scope: "read write" },
      },
      notes: ["dropped oauth client_secret: pi has no such field"],
    });
  });

  it("drops env_vars with a note", () => {
    expect(convert({ command: "srv", env_vars: ["API_KEY"] })).toEqual({
      server: { command: "srv" },
      notes: ["dropped env_vars: pi passes its whole environment to stdio servers"],
    });
  });

  it("reads an entry with both command and url as stdio and drops the url", () => {
    expect(convert({ command: "srv", url: "https://x.test/mcp" })).toEqual({
      server: { command: "srv" },
      notes: ["dropped url: pi has no such field"],
    });
  });

  it("skips an entry without command or url and one with malformed fields", () => {
    expect(convert({ enabled: true })).toEqual({ skip: expect.stringMatching(/needs "command"/) });
    expect(convert({ command: "x", args: [1] })).toEqual({ skip: "has args that are not a list of strings" });
  });

  it("skips a server whose env sets a CODEX_ variable and keeps one with other names", () => {
    expect(convert({ command: "node", env: { LOG_LEVEL: "1", CODEX_HOME: "/x" } })).toEqual({
      skip: "is Codex's own helper: its env sets CODEX_HOME",
    });
    expect(convert({ command: "node", env: { LOG_LEVEL: "1", MY_CODEX_DIR: "/x" } })).toEqual({
      server: { command: "node", env: { LOG_LEVEL: "1", MY_CODEX_DIR: "/x" } },
      notes: [],
    });
    expect(claude.convert({ command: "node", env: { CODEX_HOME: "/x" } }, fixed)).toMatchObject({
      server: { command: "node" },
    });
  });

  it("drops every other field, type included, with a note", () => {
    expect(
      convert({ type: "sse", url: "https://x.test/mcp", http_headers_helper: "h", startup_timeout_sec: 5 }),
    ).toEqual({
      server: { url: "https://x.test/mcp" },
      notes: ["dropped type, http_headers_helper, startup_timeout_sec: pi has no such field"],
    });
  });
});
