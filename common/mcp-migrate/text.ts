import { sep } from "node:path";

export const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export const homeRelative = (path: string, home: string): string =>
  home && (path === home || path.startsWith(`${home}${sep}`)) ? `~${path.slice(home.length)}` : path;
