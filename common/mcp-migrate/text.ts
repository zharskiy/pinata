import { sep } from "node:path";

export const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch (error) {
    const at = /\(line (\d+) column (\d+)\)/.exec(errorText(error));

    throw new Error(at ? `invalid JSON at line ${at[1]}, column ${at[2]}` : "invalid JSON");
  }
};

export const homeRelative = (path: string, home: string): string =>
  home && (path === home || path.startsWith(`${home}${sep}`)) ? `~${path.slice(home.length)}` : path;
