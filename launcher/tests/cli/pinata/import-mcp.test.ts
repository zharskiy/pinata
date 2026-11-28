import { chmod, lstat, readFile, stat, symlink } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { VmInspect } from "../../../backend/index.ts";
import { exists, tempDir, writeJson, writeText } from "../../support/temp-dir.ts";
import { createPinata } from "./support.ts";

const RUNNING: VmInspect = { state: "running", size: { cpus: 4, memoryGiB: 8, diskGiB: 60 }, shares: [] };

const GITHUB = { command: "gh" };

const LINEAR = { url: "https://linear.test/mcp" };

const DOCS = { command: "docs" };

const NOTHING_CHANGED = "Pinata is already installed. Nothing changed.\n";

const IMPORTED =
  "ok Imported MCP servers github, linear, docs from ~/.claude.json (user scope), ~/.cursor/mcp.json, ~/.codex/config.toml into ~/.pi/agent/mcp.json\n";

const setUp = async () => {
  const pinata = await createPinata({ vm: { inspect: async () => RUNNING } });

  await writeJson(join(pinata.home, ".claude.json"), { mcpServers: { github: GITHUB } });

  await writeJson(join(pinata.home, ".cursor", "mcp.json"), { mcpServers: { linear: LINEAR } });

  await writeText(join(pinata.home, ".codex", "config.toml"), '[mcp_servers.docs]\ncommand = "docs"\n');

  return { ...pinata, mcpJson: join(pinata.harness.hostAgentDir, "mcp.json") };
};

const serversOf = async (file: string) => JSON.parse(await readFile(file, "utf8")).mcpServers;

describe("pinata install's MCP import", () => {
  it("imports the user-scope servers of every app into the host agent dir's mcp.json", async () => {
    const pinata = await setUp();

    expect(await pinata.run("install", "--yes")).toBe(0);
    expect(await serversOf(pinata.mcpJson)).toEqual({ github: GITHUB, linear: LINEAR, docs: DOCS });
    expect(pinata.harness.stdout()).toContain(`\n${IMPORTED}`);
    expect(pinata.harness.stderr()).toBe("");
  });

  it("prints a server's conversion notes under the line", async () => {
    const pinata = await setUp();

    await writeJson(join(pinata.home, ".claude.json"), {
      mcpServers: { github: { ...GITHUB, timeout: 30000 } },
    });

    expect(await pinata.run("install", "--yes")).toBe(0);
    expect(pinata.harness.stdout()).toContain(`${IMPORTED}  github: timeout 30000 ms became 30 s\n`);
  });

  it("stays silent and changes nothing on a rerun", async () => {
    const pinata = await setUp();

    expect(await pinata.run("install", "--yes")).toBe(0);

    const before = await readFile(pinata.mcpJson, "utf8");
    const printed = pinata.harness.stdout().length;

    expect(await pinata.run("install", "--yes")).toBe(0);
    expect(pinata.harness.stdout().slice(printed)).toBe(NOTHING_CHANGED);
    expect(await readFile(pinata.mcpJson, "utf8")).toBe(before);
  });

  it("leaves existing servers alone and adds only new ones", async () => {
    const pinata = await setUp();
    const mine = { command: "my-gh" };

    await writeJson(pinata.mcpJson, { mcpServers: { github: mine } });

    expect(await pinata.run("install", "--yes")).toBe(0);
    expect(await serversOf(pinata.mcpJson)).toEqual({ github: mine, linear: LINEAR, docs: DOCS });
    expect(pinata.harness.stdout()).toContain(
      "ok Imported MCP servers linear, docs from ~/.cursor/mcp.json, ~/.codex/config.toml into ~/.pi/agent/mcp.json\n",
    );
  });

  it("skips the import with --no-mcp-import", async () => {
    const pinata = await setUp();

    expect(await pinata.run("install", "--yes", "--no-mcp-import")).toBe(0);
    expect(await exists(pinata.mcpJson)).toBe(false);
    expect(pinata.harness.stdout()).not.toContain("MCP");
  });

  it("warns and writes nothing when mcp.json is invalid", async () => {
    const pinata = await setUp();

    await writeText(pinata.mcpJson, "{");

    expect(await pinata.run("install", "--yes")).toBe(0);

    const printed = pinata.harness.stdout().length;

    expect(pinata.harness.stdout()).toContain(
      "\n! ~/.pi/agent/mcp.json: invalid JSON at line 1, column 2; no MCP servers imported, fix it and run pinata install again\n",
    );
    expect(await readFile(pinata.mcpJson, "utf8")).toBe("{");
    expect(await pinata.run("install", "--yes")).toBe(0);
    expect(pinata.harness.stdout().slice(printed)).toMatch(new RegExp(`\n\n${NOTHING_CHANGED}$`));
  });

  it("imports the other apps when one file cannot be read, without printing its text", async () => {
    const pinata = await setUp();
    const claudeJson = join(pinata.home, ".claude.json");

    await writeText(claudeJson, '{"mcpServers": secret-token}');

    expect(await pinata.run("install", "--yes")).toBe(0);
    expect(await serversOf(pinata.mcpJson)).toEqual({ linear: LINEAR, docs: DOCS });
    expect(pinata.harness.stdout()).toContain(
      `\n! cannot read ${claudeJson}: invalid JSON; its MCP servers were not imported\n`,
    );
    expect(pinata.harness.stdout()).not.toContain("secret-token");
  });

  it("writes a new mcp.json private and keeps an existing file's mode", async () => {
    const created = await setUp();
    const existing = await setUp();

    await writeJson(existing.mcpJson, {});

    await chmod(existing.mcpJson, 0o644);

    expect(await created.run("install", "--yes")).toBe(0);
    expect(await existing.run("install", "--yes")).toBe(0);
    expect((await stat(created.mcpJson)).mode & 0o777).toBe(0o600);
    expect((await stat(existing.mcpJson)).mode & 0o777).toBe(0o644);
  });

  it("writes through a linked mcp.json", async () => {
    const pinata = await setUp();
    const elsewhere = join(pinata.harness.root, "elsewhere.json");

    await writeJson(elsewhere, {});

    await symlink(elsewhere, pinata.mcpJson);

    expect(await pinata.run("install", "--yes")).toBe(0);
    expect((await lstat(pinata.mcpJson)).isSymbolicLink()).toBe(true);
    expect(await serversOf(elsewhere)).toEqual({ github: GITHUB, linear: LINEAR, docs: DOCS });
  });

  it("reads Codex's user file from CODEX_HOME", async () => {
    const codexHome = await tempDir("codex");
    const pinata = await createPinata({
      vm: { inspect: async () => RUNNING },
      env: { CODEX_HOME: codexHome },
    });

    await writeText(join(codexHome, "config.toml"), '[mcp_servers.docs]\ncommand = "docs"\n');

    expect(await pinata.run("install", "--yes")).toBe(0);
    expect(await serversOf(join(pinata.harness.hostAgentDir, "mcp.json"))).toEqual({ docs: DOCS });
    expect(pinata.harness.stdout()).toContain(
      `ok Imported MCP servers docs from ${join(codexHome, "config.toml")} into ~/.pi/agent/mcp.json\n`,
    );
  });
});
