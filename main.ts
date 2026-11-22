// Vaultbreak — The Meridian Job (Node 22, standard library only): the game
// is this directory's game/ folder, plain static files a desktop browser
// loads offline (game/index.html and its ES modules, no library and no
// network request), and the program hands it in. It copies game/ and
// screenshots/ from beside this file to /output and writes
// /output/dossier.json, the summary the judge reads, with the vendored
// make.fun library. A top-down stealth heist: three floors, patrolling
// guards with raycast vision cones, sweeping cameras, an alarm meter, and
// a Blackout Mode that kills the lights for a 15% richer haul. Before the
// copy it checks the hand-in is complete — 3 or 4 screenshots, each under
// the cap — and after the write it prints what it handed in.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The hand-in is only complete with its screenshots: 3 or 4 of them, each
// a real render of the game, each under the 256 KiB cap. Warn, never throw:
// a missing shot is a maker's mistake to fix, not a crash to hide.
const shotDir = join(here, 'screenshots');
const shotNames = existsSync(shotDir) ? readdirSync(shotDir).sort() : [];
for (const name of shotNames) {
  const bytes = statSync(join(shotDir, name)).size;
  if (bytes > 262144) console.warn(`screenshot over the cap: ${name} is ${bytes} bytes`);
}
if (shotNames.length < 3) console.warn(`only ${shotNames.length} screenshot(s) — the hand-in wants 3 or 4`);
if (shotNames.length > 4) console.warn(`${shotNames.length} screenshots — the hand-in takes at most 4`);

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(shotDir)) cpSync(shotDir, join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// What was handed in, in one line: the game files, the screenshots, and
// the dossier's own weight. The /output bytes are the same every run.
const gameFiles = readdirSync(join(out, 'game'), { recursive: true }).length;
const dossierBytes = statSync(join(out, 'dossier.json')).size;
const shotBytes = shotNames.reduce((sum, name) => sum + statSync(join(shotDir, name)).size, 0);
console.log(
  `Vaultbreak handed in: ${gameFiles} game files, ${shotNames.length} screenshots (${shotNames.join(', ')}, ${shotBytes} bytes), dossier ${dossierBytes} bytes`,
);
