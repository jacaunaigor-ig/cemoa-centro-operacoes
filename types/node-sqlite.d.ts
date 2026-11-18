declare module "node:sqlite" {
  export class DatabaseSync {
    constructor(path: string, options?: { readOnly?: boolean });
    prepare(sql: string): {
      all: (...args: unknown[]) => unknown[];
    };
    close(): void;
  }
}
