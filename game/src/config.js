// SUGARWRIGHT — content bible: realms, syrups, creatures, waves, upgrades,
// relics, workshop unlocks, feats. Pure data; the engine reads it, nothing
// here touches the DOM or the clock.

export const VIEW_W = 1280;
export const VIEW_H = 720;
export const ARENA = { x: 268, y: 92, w: 744, h: 520 }; // play field inside the HUD frame
export const CAULDRON = { x: 640, y: 352, r: 44 };

export const SYRUPS = [
  { id: 'amber', name: 'AMBER', key: '1', color: '#ffb03a', tint: 'rgba(255,176,58,', desc: 'Balanced bubble, honest shatter.' },
  { id: 'berry', name: 'BERRY', key: '2', color: '#ff5d7a', tint: 'rgba(255,93,122,', desc: 'Thick skin: bubbles last longer, trapped sourlings crawl.' },
  { id: 'mint', name: 'MINT', key: '3', color: '#4fe3c1', tint: 'rgba(79,227,193,', desc: 'Shatter flash-freezes everything nearby.' },
  { id: 'cola', name: 'COLA', key: '4', color: '#c98bff', tint: 'rgba(201,139,255,', desc: 'Fizzy: shatter bursts in a wide, hard explosion.' },
];

export const REALMS = [
  { name: 'THE SUGAR MILL', floor: '#3a2417', brick: '#4a2d1b', line: '#5d3a22', glow: 'rgba(255,150,50,' },
  { name: 'LICORICE HOLLOW', floor: '#22142e', brick: '#2d1b3d', line: '#3c2752', glow: 'rgba(170,110,255,' },
  { name: 'THE SOUR VAULT', floor: '#0f2a24', brick: '#14362e', line: '#1d4a3e', glow: 'rgba(80,255,190,' },
];

// behaviour: 'cauldron' walks at the melt and leeches heat; 'hunter' chases the
// smith; 'charger' lines up and rushes; 'spitter' keeps range and lobs globs;
// 'splitter' breaks into mites when killed untrapped.
export const CREATURES = {
  sourling: { name: 'Sourling', hp: 3, speed: 46, r: 15, score: 90, crystals: 1, behaviour: 'cauldron', color: '#b8e356', leech: 1.6 },
  mite: { name: 'Tangmite', hp: 1, speed: 74, r: 9, score: 50, crystals: 0, behaviour: 'cauldron', color: '#e8f06a', leech: 0.8 },
  fizzbat: { name: 'Fizzbat', hp: 2, speed: 96, r: 12, score: 130, crystals: 1, behaviour: 'hunter', color: '#7ad0ff', dmg: 8 },
  roller: { name: 'Peppermint Roller', hp: 5, speed: 40, r: 16, score: 170, crystals: 2, behaviour: 'charger', color: '#ff6b6b', dmg: 14 },
  lancer: { name: 'Licorice Lancer', hp: 4, speed: 38, r: 14, score: 190, crystals: 2, behaviour: 'spitter', color: '#8a5cff', dmg: 10 },
  wisp: { name: 'Sour Wisp', hp: 2, speed: 58, r: 13, score: 120, crystals: 1, behaviour: 'cauldron', color: '#a0ffd0', leech: 1.2, splits: true },
  brute: { name: 'Jelly Brute', hp: 16, speed: 24, r: 26, score: 420, crystals: 5, behaviour: 'cauldron', color: '#ff9ff3', leech: 3.2, knockResist: 0.8 },
  golem: { name: 'Gumball Golem', hp: 26, speed: 20, r: 30, score: 650, crystals: 7, behaviour: 'hunter', color: '#ffd166', dmg: 20, knockResist: 0.9 },
};

export const BOSSES = {
  caramel: { name: 'THE CARAMEL BRUTE', hp: 260, speed: 17, r: 52, score: 6000, crystals: 60, color: '#e08a2e', phases: 2 },
  bitterking: { name: 'KING BITTER', hp: 430, speed: 21, r: 58, score: 15000, crystals: 150, color: '#9fe870', phases: 3 },
};

// 9 waves across 3 realms. comp: [creatureId, count]. trickle keeps pressure
// up during boss waves.
export const WAVES = [
  { name: 'THE FIRST SOURING', comp: [['sourling', 8], ['mite', 4]] },
  { name: 'TANG ON THE WIND', comp: [['sourling', 10], ['mite', 6], ['fizzbat', 2]] },
  { name: 'ROLLING STOCK', comp: [['sourling', 12], ['mite', 6], ['roller', 3]] },
  { name: 'HOLLOW VOICES', comp: [['fizzbat', 6], ['sourling', 10], ['lancer', 2]] },
  { name: 'THE LICORICE ROAD', comp: [['roller', 5], ['mite', 10], ['wisp', 4], ['lancer', 3]] },
  { name: 'SOMETHING STICKY', boss: 'caramel', comp: [['mite', 6]], trickle: [['mite', 2], ['sourling', 1]] },
  { name: 'VAULT OF TEETH', comp: [['wisp', 8], ['lancer', 4], ['sourling', 12], ['golem', 1]] },
  { name: 'THE LONG NIGHT SHIFT', comp: [['golem', 2], ['roller', 6], ['fizzbat', 8], ['wisp', 6]] },
  { name: 'THE BITTERING', boss: 'bitterking', comp: [['sourling', 6]], trickle: [['wisp', 1], ['fizzbat', 1], ['mite', 2]] },
];

export const ROADS = [
  { id: 'surge', key: 'Q', name: 'SOUR SURGE', icon: 'star', desc: 'ELITE PACK · +RELIC AT WAVE END', mult: 1.4, gift: 'relic' },
  { id: 'quiet', key: 'W', name: 'QUIET ROAD', icon: 'cross', desc: 'NO TOLL · NO GIFT · +20 HEAT', mult: 1.0, gift: 'heat' },
  { id: 'cache', key: 'E', name: 'CRYSTAL CACHE', icon: 'diamond', desc: '+50 CRYSTALS · +FIZZBATS', mult: 1.0, gift: 'cache' },
];

export const UPGRADES = [
  { id: 'wide', name: 'WIDE PIPE', icon: 'W', desc: 'Bubbles grow wider: +14% max radius.', max: 3 },
  { id: 'quick', name: 'QUICK BLOW', icon: 'Q', desc: 'Bubbles inflate 22% faster.', max: 3 },
  { id: 'twin', name: 'TWIN SPARK', icon: 'T', desc: 'Shatters throw +2 extra shards.', max: 3 },
  { id: 'sharp', name: 'SHARP SHARDS', icon: 'S', desc: 'Shard damage +35%.', max: 3 },
  { id: 'wind', name: 'SECOND WIND', icon: '2', desc: 'Every shatter hands back a little breath.', max: 3 },
  { id: 'bricks', name: 'CAULDRON BRICKS', icon: 'B', desc: '+25 maximum melt heat.', max: 3 },
  { id: 'lungs', name: 'DEEP LUNGS', icon: 'L', desc: '+25 maximum breath.', max: 3 },
  { id: 'apron', name: 'STURDY APRON', icon: 'A', desc: '+25 maximum health.', max: 3 },
  { id: 'rush', name: 'SUGAR RUSH', icon: 'R', desc: 'Move 12% faster.', max: 3 },
  { id: 'last', name: 'LONG LAST', icon: 'O', desc: 'Bubbles hold 40% longer before popping.', max: 3 },
  { id: 'catch', name: 'BIG CATCH', icon: 'C', desc: 'Bubbles trap +1 creature.', max: 3 },
  { id: 'chain', name: 'CHAIN SYRUP', icon: 'N', desc: 'Chain reactions reach 25% further.', max: 3 },
  { id: 'tooth', name: 'SWEET TOOTH', icon: 'E', desc: 'Crystals are worth 20% more.', max: 3 },
  { id: 'ember', name: 'EMBER HEART', icon: 'H', desc: 'The melt slowly re-stokes itself.', max: 3 },
  { id: 'boots', name: 'DASH BOOTS', icon: 'D', desc: 'Dash recharges 30% faster.', max: 3 },
];

export const RELICS = [
  { id: 'stone', name: 'CAULDRON STONE', icon: 'K', desc: 'The melt loses heat 30% slower.' },
  { id: 'lucky', name: 'LUCKY CRYSTAL', icon: 'X', desc: 'Crystals sometimes count double.' },
  { id: 'cannon', name: 'SUGAR CANNON', icon: 'G', desc: '+60% shard damage, -20 max health.' },
  { id: 'echo', name: 'ECHO BELL', icon: 'E', desc: 'Every shatter echoes once at half strength.' },
  { id: 'bellows', name: 'BELLOWS', icon: 'F', desc: 'Breath returns 50% faster.' },
  { id: 'coals', name: 'HOT COALS', icon: 'H', desc: 'The melt burns creatures that crowd it.' },
  { id: 'ribbon', name: 'MAGNET RIBBON', icon: 'M', desc: 'Crystals drift to you on their own.' },
  { id: 'veil', name: 'FROSTING VEIL', icon: 'V', desc: 'Mint freezes last twice as long.' },
  { id: 'heart', name: 'CANDY HEART', icon: 'C', desc: 'Shattering a full bubble heals 2 health.' },
  { id: 'pipe', name: 'TWIN PIPE', icon: 'P', desc: 'A second, smaller bubble follows the first.' },
];

// Permanent workshop unlocks, bought with banked crystals between runs.
export const WORKSHOP = [
  { id: 'w_apron', name: 'STURDY APRON', icon: 'SA', desc: '+15 max health per rank.', max: 3, prices: [100, 160, 240] },
  { id: 'w_coals', name: 'BANKED COALS', icon: 'BC', desc: 'Start with +15 melt heat per rank.', max: 3, prices: [100, 160, 240] },
  { id: 'w_lungs', name: 'DEEP LUNGS', icon: 'DL', desc: '+12 max breath per rank.', max: 3, prices: [100, 160, 240] },
  { id: 'w_head', name: 'HEAD START', icon: 'HS', desc: 'Begin each run with +40 crystals per rank.', max: 2, prices: [150, 220] },
  { id: 'w_heirloom', name: 'HEIRLOOM PIPE', icon: 'HP', desc: 'Bubbles start 8% wider per rank.', max: 2, prices: [200, 300] },
  { id: 'w_haggle', name: 'SWEET TALKER', icon: 'ST', desc: 'Workshop prices 15% lower per rank.', max: 2, prices: [180, 260] },
  { id: 'w_cola', name: 'FOURTH SYRUP', icon: 'FS', desc: 'Unlock COLA syrup from wave 1.', max: 1, prices: [250] },
  { id: 'w_endless', name: 'ENDLESS NIGHT', icon: 'EN', desc: 'Unlock endless mode after a victory.', max: 1, prices: [300] },
];

export const DIFFICULTIES = [
  { id: 'apprentice', name: 'APPRENTICE', scoreMult: 0.8, enemyMult: 0.8, hpMult: 0.85 },
  { id: 'journeyman', name: 'JOURNEYMAN', scoreMult: 1.0, enemyMult: 1.0, hpMult: 1.0 },
  { id: 'master', name: 'MASTER', scoreMult: 1.5, enemyMult: 1.25, hpMult: 1.3 },
];

export const FEATS = [
  { id: 'king', name: 'SHATTERED KING BITTER' },
  { id: 'brute', name: 'BROKE THE CARAMEL BRUTE' },
  { id: 'heat', name: 'KEPT THE MELT ABOVE HALF HEAT' },
  { id: 'health', name: 'FINISHED ABOVE HALF HEALTH' },
  { id: 'chain5', name: 'CHAIN OF 5 BUBBLES OR MORE' },
  { id: 'trap4', name: 'TRAPPED 4 CREATURES IN ONE BUBBLE' },
  { id: 'combo5', name: 'REACHED COMBO x5' },
  { id: 'allsyrup', name: 'SHATTERED ALL 4 SYRUPS' },
];

export function gradeFor(score) {
  if (score >= 120000) return 'S';
  if (score >= 80000) return 'A';
  if (score >= 45000) return 'B';
  if (score >= 20000) return 'C';
  return 'D';
}
