# SUGARWRIGHT

Trap the sourlings in spun-sugar bubbles. Shatter them. Chain the candy.

A top-down arena defence game in a single static page — no build step, no
libraries, no network. You are the sugarwright: keeper of the Melt, the great
candy cauldron at the centre of the workshop. Sour creatures stream in to
drink its heat. Blow bubbles of spun sugar on your pipe, let the sourlings
wander in and get trapped, then shatter every bubble at once and let the
chain reactions do the killing.

## The run

- **3 realms** (The Sugar Mill, Licorice Hollow, The Sour Vault), **9 waves**,
  **2 bosses** — the Caramel Brute on wave 6 and King Bitter, in three
  phases, on wave 9.
- **Win** by shattering King Bitter. **Lose** when the melt's heat or your
  health hits zero. Creatures that reach the cauldron leech its heat;
  shattering bubbles close to the melt stokes it back up.
- **8 creatures**: sourlings and tangmites that march on the melt, fizzbats
  that hunt you, peppermint rollers that line up and charge, licorice lancers
  that spit from range, sour wisps that split, jelly brutes, gumball golems.

## The verbs

- **WASD / arrows** — move. **Hold LMB (or J)** — blow: a bubble grows on the
  pipe while your breath lasts. Release to set it adrift.
- **RMB (or K)** — shatter every set bubble at once. Trapped creatures die,
  shards fly, and syrup effects fire: **Amber** (honest), **Berry** (tough,
  slows), **Mint** (flash-freeze), **Cola** (wide explosion). Keys **1–4**
  switch syrup; Cola is a workshop unlock.
- **Space** — dash with a blink of invulnerability. **P** pause, **M** sound.

## Between waves

Pick **1 of 3 upgrades** (15 in the pool, stacking to rank 3: Wide Pipe,
Second Wind, Cauldron Bricks, Chain Syrup…) and **1 of 3 roads** for the next
wave: Sour Surge (an elite pack, and a relic when you clear it), Quiet Road
(heat and a breather), or Crystal Cache (free crystals, extra fizzbats).
**10 relics** — Echo Bell, Hot Coals, Magnet Ribbon, Twin Pipe — bend the
rules of a run.

## The workshop

Crystals earned in a run are banked for good. Spend them on **8 permanent
unlocks** — Sturdy Apron, Banked Coals, Deep Lungs, Head Start, Heirloom
Pipe, Sweet Talker, the Fourth Syrup, and Endless Night, which opens an
endless mode after a victory. Three difficulties (Apprentice, Journeyman,
Master) scale the sour and the score. Every run is graded S–D against 8
feats.

## Layout

- `game/index.html` — the page, HUD and screens.
- `game/src/config.js` — all content: realms, creatures, waves, upgrades,
  relics, workshop, feats.
- `game/src/engine.js` — the rules: blowing, trapping, shattering, chains,
  heat, bosses, roads, meta-progression.
- `game/src/render.js` — the canvas world. `game/src/ui.js` — HUD and
  screens. `game/src/audio.js` — synthesized sound, no files.
- `game/src/shots.js` — staged scenes for the screenshots
  (`?shot=title|play|upgrade|end&seed=7`).
- `main.ts` — hands the game in: copies `game/` and `screenshots/` to the
  output folder and writes the dossier.
