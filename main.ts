// SPDX-License-Identifier: MIT
// SUGARWRIGHT — entrypoint for make.fun best-game-01 ("Make the best game").
// Node 22, standard library only. The game is this directory's game/ folder
// (plain static files a desktop browser loads offline: game/index.html and its
// ES modules, no library, no network request), and this program hands it in:
// it validates the judge's screenshot contract first, then copies game/ and
// screenshots/ from beside this file to /output and writes /output/dossier.json,
// the summary the judge reads, with the vendored make.fun library.
//
// The game itself: a candy smith coats sourlings in spun-sugar bubbles and
// cracks them into candy chains. Three realms, nine waves, two bosses, sixteen
// upgrades, twelve relics, four syrups — staged in four screenshots whose first
// file by name is the cover (the boss fight).
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the others refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of
// game files, in all, or a path under game/ over 1000 bytes: game/ counts
// beside /output's own 1000-entry cap, its screenshots/ and dossier.json).
const SCREENSHOT_CAP = { max: 4, maxBytes: 262144 };
const GAME_CAP = { maxFiles: 993, maxBytes: 50331648, pathMaxBytes: 1000 };

const root = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const shotsDir = join(root, 'screenshots');

/** Fail loudly before the dossier is built if the judge's shot contract is broken. */
function checkShots() {
  if (!existsSync(join(root, 'game', 'index.html'))) {
    throw new Error('SUGARWRIGHT: game/index.html is missing');
  }
  if (!existsSync(shotsDir)) throw new Error('SUGARWRIGHT: screenshots/ is missing');
  const shots = readdirSync(shotsDir)
    .filter((name) => /\.(png|jpe?g)$/i.test(name))
    .sort();
  if (shots.length === 0 || shots.length > SCREENSHOT_CAP.max) {
    throw new Error(`SUGARWRIGHT: expected 1-${SCREENSHOT_CAP.max} screenshots, found ${shots.length}`);
  }
  for (const name of shots) {
    const size = statSync(join(shotsDir, name)).size;
    if (size > SCREENSHOT_CAP.maxBytes) {
      throw new Error(`SUGARWRIGHT: ${name} is ${size} bytes, over the 256 KiB cap`);
    }
  }
  return shots;
}

const shots = checkShots();
mkdirSync(outDir, { recursive: true });
cpSync(join(root, 'game'), join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });

writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: SCREENSHOT_CAP.max, max_bytes: SCREENSHOT_CAP.maxBytes },
    game_max_files: GAME_CAP.maxFiles,
    game_max_bytes: GAME_CAP.maxBytes,
    game_path_max_bytes: GAME_CAP.pathMaxBytes,
  }),
);

console.log(`SUGARWRIGHT: dossier built from ${shots.length} screenshots (${shots[0]} is the cover)`);
