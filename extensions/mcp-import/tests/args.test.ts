import { describe, expect, it } from "vitest";
import { completeArgs, parseArgs, USAGE } from "../core/args.ts";

describe("mcp-import arguments", () => {
  it("defaults to a user-scope dry run", () => {
    expect(parseArgs("claude")).toMatchObject({ migrator: { id: "claude" }, scope: "user", apply: false });
  });

  it("reads project and apply in any order", () => {
    expect(parseArgs(" cursor apply  project ")).toMatchObject({
      migrator: { id: "cursor" },
      scope: "project",
      apply: true,
    });
  });

  it("reads codex as a source", () => {
    expect(parseArgs("codex project")).toMatchObject({
      migrator: { id: "codex" },
      scope: "project",
      apply: false,
    });
  });

  it("asks for the interactive choice without arguments", () => {
    expect(parseArgs("  ")).toEqual({ interactive: true });
  });

  it("names every tool in the usage", () => {
    expect(USAGE).toBe("/mcp-import <claude|cursor|codex> [project] [apply]");
  });

  it("rejects an unknown tool and unknown words", () => {
    expect(parseArgs("other")).toEqual({
      error: expect.stringMatching(/^unknown tool "other" \(available: claude, cursor, codex\)/),
    });
    expect(parseArgs("claude now")).toEqual({ error: expect.stringMatching(/^unknown argument "now"/) });
  });

  it("completes the tool, then the flags not yet given", () => {
    expect(completeArgs("c")).toEqual([
      { value: "claude", label: "claude" },
      { value: "cursor", label: "cursor" },
      { value: "codex", label: "codex" },
    ]);
    expect(completeArgs("co")).toEqual([{ value: "codex", label: "codex" }]);
    expect(completeArgs("claude ")).toEqual([
      { value: "claude project", label: "project" },
      { value: "claude apply", label: "apply" },
    ]);
    expect(completeArgs("claude apply p")).toEqual([{ value: "claude apply project", label: "project" }]);
    expect(completeArgs("x")).toBeNull();
  });
});
