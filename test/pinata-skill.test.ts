import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "..");
const SKILL_DIR = join(ROOT, "skills", "pinata");
const skill = readFileSync(join(SKILL_DIR, "SKILL.md"), "utf8");
const description = skill.match(/^description: (.*)$/m)?.[1] ?? "";
const pi: { extensions: string[] } = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).pi;
const extensions = pi.extensions.map((entry) => basename(dirname(entry)));

describe("pinata skill", () => {
  it("has a one-line description pi's YAML parser keeps", () => {
    expect(skill).toMatch(/^---\nname: pinata\ndescription: .+\n---\n/);
    expect(description.length).toBeLessThanOrEqual(1024);
    expect(description).not.toMatch(/: | #|:$|^['"[{&*!|>%@`]/);
  });

  it("names every extension in its description", () => {
    expect(extensions.filter((name) => !description.includes(name))).toEqual([]);
  });

  it("points only at docs that exist", () => {
    const paths = [...skill.matchAll(/`(\.\.\/\.\.\/[^`]+)`/g)].map((match) => match[1]);
    const expanded = paths.flatMap((path) =>
      path.includes("<name>") ? extensions.map((name) => path.replace("<name>", name)) : [path],
    );

    expect(paths.length).toBeGreaterThan(0);
    expect(expanded.filter((path) => !existsSync(resolve(SKILL_DIR, path)))).toEqual([]);
  });
});
