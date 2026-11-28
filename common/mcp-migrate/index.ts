import type { Migrator } from "./migrator.ts";
import { claude } from "./migrators/claude.ts";
import { codex } from "./migrators/codex.ts";
import { cursor } from "./migrators/cursor.ts";

export const MIGRATORS: readonly Migrator[] = [claude, cursor, codex];

export { findServers } from "./find.ts";
export type { Found, Migrator } from "./migrator.ts";
export { type Entry, needsSignIn, type Plan, planImport, type Skipped } from "./plan.ts";
