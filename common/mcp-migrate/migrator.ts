export type Scope = "user" | "project";

export type Places = { home: string; cwd: string; env: NodeJS.ProcessEnv };

export type Servers = Record<string, unknown>;

export type RawServer = Record<string, unknown>;

export type PiServer = Record<string, unknown>;

export type Conversion = { server: PiServer; notes: string[] } | { skip: string };

export type ConfigFile = {
  label: string;
  path: string;
  parse?: (text: string) => unknown;
  servers: (data: unknown) => Servers | string;
  note?: string;
};

export type Migrator = {
  id: string;
  name: string;
  files: (scope: Scope, places: Places) => ConfigFile[];
  convert: (raw: RawServer, places: Places) => Conversion;
};

export type Origin = { label: string; servers: Servers; note?: string; convert: Migrator["convert"] };

export type Found = { origins: Origin[]; checked: string[]; problems: string[] };
