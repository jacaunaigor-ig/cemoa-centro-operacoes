import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const skip = path.join(root, ".pages-skip");
const api = path.join(root, "app", "api");
const tiles = path.join(root, "app", "tiles");
const apiOff = path.join(skip, "api");
const tilesOff = path.join(skip, "tiles");

mkdirSync(skip, { recursive: true });
renameSync(api, apiOff);
renameSync(tiles, tilesOff);

let status = 1;
try {
  const result = spawnSync("npx", ["next", "build"], {
    stdio: "inherit",
    env: {
      ...process.env,
      GITHUB_PAGES: "1",
      NEXT_PUBLIC_STATIC: "1",
      NEXT_PUBLIC_BASE_PATH: "/cemoa-centro-operacoes",
    },
  });
  status = result.status ?? 1;
  if (status === 0) {
    writeFileSync(path.join(root, "out", ".nojekyll"), "");
  }
} finally {
  renameSync(apiOff, api);
  renameSync(tilesOff, tiles);
  rmSync(skip, { recursive: true, force: true });
}

process.exit(status);
