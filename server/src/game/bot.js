/**
 * bot.js — AI decision engine for PVE bots.
 *
 * Five difficulty levels (1–5):
 *   1 = 🐣 Estagiário  — pure random, never bluffs
 *   2 = 📋 CLT          — basic strategy, rarely bluffs
 *   3 = 👔 Patrão       — uses cards well, occasional bluff
 *   4 = 🏛️ Deputado     — smart challenges + blocks, frequent bluffs
 *   5 = 👑 Dono do Morro — near-optimal, tracks dead cards, aggressive
 */

const { ACTION_DEFS } = require('./actions');

// ── Constants ────────────────────────────────────────────────────────────────

const BOT_COUNTS = {
  estagiario: 2,
  clt:        3,
  patrao:     3,
  deputado:   4,
  dono_morro: 5,
};

const BOT_DIFFICULTY_LEVELS = {
  estagiario: 1,
  clt:        2,
  patrao:     3,
  deputado:   4,
  dono_morro: 5,
};

const BOT_NAMES = ['Zé do Coreto', 'Claudinho', 'Magrão', 'Tonhão', 'Biqueira'];

// Think-time per difficulty (ms): [min, max]
const THINK_DELAYS = {
  1: [1200, 2400],
  2: [ 900, 1800],
  3: [ 700, 1400],
  4: [ 500, 1000],
  5: [ 400,  800],
};

// How much each character is "worth" (used for discard decisions)
const CHAR_VALUE = {
  guarda_costas: 6,
  investigador:  5,
  juiz:          4,
  assassino:     3,
  empresario:    2,
  politico:      1,
};

// ── Internal helpers ─────────────────────────────────────────────────────────

function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getPlayer(game, id) {
  return game.players.find(p => p.id === id) || null;
}

function getAlivePlayers(game) {
  return game.players.filter(p => p.cards.some(c => !c.dead));
}

function botAliveCards(game, botId) {
  const p = getPlayer(game, botId);
  if (!p) return [];
  return p.cards.map((c, i) => ({ ...c, idx: i })).filter(c => !c.dead);
}

function botCharacters(game, botId) {
  return botAliveCards(game, botId).map(c => c.character);
}

function botCoins(game, botId) {
  return getPlayer(game, botId)?.coins ?? 0;
}

/** Count how many copies of a character are already face-up (dead). */
function countDeadChar(game, char) {
  return game.players.flatMap(p => p.cards).filter(c => c.dead && c.character === char).length;
}

/** Estimate probability that a player actually holds `char` given dead cards and own hand. */
function suspicionScore(game, botId, char) {
  const dead   = countDeadChar(game, char);
  const own    = botCharacters(game, botId).filter(c => c === char).length;
  const remaining = 3 - dead - own; // copies unaccounted for
  if (remaining <= 0) return 0.95;  // almost certainly bluffing
  if (own > 0)        return 0.45;  // bot holds one copy → reduced pool
  return 0.10;                      // normal suspicion
}

// ── Public: think delay ───────────────────────────────────────────────────────

function getThinkDelay(difficultyLevel) {
  const [mn, mx] = THINK_DELAYS[difficultyLevel] || THINK_DELAYS[1];
  return mn + Math.floor(Math.random() * (mx - mn));
}

// ── Action Selection ──────────────────────────────────────────────────────────

/**
 * Choose an action + optional targetId for the bot's turn.
 * Returns { action: string, targetId: string|null }
 */
function chooseBotAction(game, botId, level) {
  const coins = botCoins(game, botId);
  const chars = botCharacters(game, botId);
  const alive = getAlivePlayers(game).filter(p => p.id !== botId);

  // Forced golpe at ≥10 coins
  if (coins >= 10 && alive.length > 0) {
    return { action: 'golpe', targetId: pickTarget(alive, level).id };
  }

  const candidates = [];

  // ── Basic actions ────────────────────────────────────────────────────────
  candidates.push({ action: 'renda',        targetId: null, score: scoreBasic('renda',        coins, level) });
  candidates.push({ action: 'ajuda_externa', targetId: null, score: scoreBasic('ajuda_externa', coins, level) });

  if (coins >= 7 && alive.length > 0) {
    candidates.push({ action: 'golpe', targetId: pickTarget(alive, level).id, score: 78 + level * 4 });
  }

  // ── Character actions (real cards or bluffs) ─────────────────────────────
  tryCharAction(candidates, game, botId, 'politico',     'taxar',      null,          chars, coins, alive, level);
  tryCharAction(candidates, game, botId, 'empresario',   'roubar',     'target_coins', chars, coins, alive, level);
  tryCharAction(candidates, game, botId, 'assassino',    'assassinar', 'any',          chars, coins, alive, level);
  tryCharAction(candidates, game, botId, 'juiz',         'veredito',   'any',          chars, coins, alive, level);
  tryCharAction(candidates, game, botId, 'investigador', 'meter_x9',   'any',          chars, coins, alive, level);
  tryCharAction(candidates, game, botId, 'investigador', 'disfarce',   null,           chars, coins, alive, level);

  const valid = candidates.filter(c => c.targetId !== '__SKIP__');
  if (valid.length === 0) return { action: 'renda', targetId: null };

  return weightedPick(valid, level);
}

function scoreBasic(action, coins, level) {
  // Renda / ajuda_externa become less attractive as coins grow (at higher levels)
  if (level <= 2) return action === 'renda' ? 22 : 18;
  return Math.max(6, 28 - coins * 3);
}

function tryCharAction(candidates, game, botId, character, action, targetMode, chars, coins, alive, level) {
  const def = ACTION_DEFS[action];
  if (!def) return;
  if (def.cost && coins < def.cost) return;
  if (def.requiresTarget && alive.length === 0) return;

  const hasChar     = chars.includes(character);
  const bluffChance = [0, 0.0, 0.12, 0.28, 0.44, 0.60][level] ?? 0.10;

  // Skip bluff for low levels
  if (!hasChar && Math.random() > bluffChance) return;

  // Determine target
  let targetId = null;
  if (targetMode === 'target_coins') {
    const rich = alive.filter(p => p.coins > 0);
    if (rich.length === 0) return;
    targetId = pickTarget(rich, level).id;
  } else if (targetMode === 'any') {
    if (alive.length === 0) return;
    targetId = pickTarget(alive, level).id;
  }

  const base = hasChar
    ? [0, 38, 52, 62, 68, 74][level] ?? 50
    : [0, 12, 22, 32, 42, 52][level] ?? 20;

  candidates.push({ action, targetId, score: base + Math.random() * 8 });
}

function pickTarget(alivePlayers, level) {
  if (level >= 4) {
    // Target most dangerous (most cards alive + most coins)
    return [...alivePlayers].sort((a, b) => {
      const aLive = a.cards.filter(c => !c.dead).length;
      const bLive = b.cards.filter(c => !c.dead).length;
      if (bLive !== aLive) return bLive - aLive;
      return b.coins - a.coins;
    })[0];
  }
  return rand(alivePlayers);
}

function weightedPick(candidates, level) {
  if (level === 1) return rand(candidates);

  if (level >= 4) {
    return candidates.reduce((best, c) => c.score > best.score ? c : best, candidates[0]);
  }

  // Weighted random proportional to score
  const total = candidates.reduce((s, c) => s + c.score, 0);
  let roll = Math.random() * total;
  for (const c of candidates) {
    roll -= c.score;
    if (roll <= 0) return c;
  }
  return candidates[candidates.length - 1];
}

// ── Challenge Decision ────────────────────────────────────────────────────────

/**
 * Should the bot challenge the current pending action?
 */
function decideBotChallenge(game, botId, level) {
  const pa = game.pendingAction;
  if (!pa) return false;
  const def = ACTION_DEFS[pa.type];
  if (!def?.challengeable) return false;
  if (pa.respondedPlayers?.includes(botId)) return false;

  const base = [0, 0.04, 0.09, 0.18, 0.30, 0.46][level] ?? 0.05;

  let chance = base;
  if (level >= 3 && pa.claimedCharacter) {
    const susp = suspicionScore(game, botId, pa.claimedCharacter);
    chance = Math.min(0.92, base + susp * [0, 0, 0.1, 0.25, 0.4, 0.55][level]);
  }

  return Math.random() < chance;
}

// ── Block Decision ────────────────────────────────────────────────────────────

/**
 * Should the bot block the current pending action?
 * Returns the character to block with, or null.
 */
function decideBotBlock(game, botId, level) {
  const pa = game.pendingAction;
  if (!pa) return null;
  const def = ACTION_DEFS[pa.type];
  if (!def?.blockable) return null;

  const isTarget    = pa.targetId === botId;
  const canAnyBlock = !!def.anyoneCanBlock;
  if (!isTarget && !canAnyBlock) return null;
  if (pa.respondedPlayers?.includes(botId)) return null;

  const blockers = def.blockedBy || [];
  if (blockers.length === 0) return null;

  const chars = botCharacters(game, botId);
  const legit = blockers.filter(b => chars.includes(b));

  const legitChance = isTarget
    ? [0, 0.38, 0.58, 0.72, 0.84, 0.94][level] ?? 0.40
    : [0, 0.18, 0.32, 0.48, 0.62, 0.78][level] ?? 0.20;

  if (legit.length > 0 && Math.random() < legitChance) {
    return rand(legit);
  }

  // Bluff block
  const bluffChance = isTarget
    ? [0, 0.04, 0.09, 0.14, 0.18, 0.22][level] ?? 0.05
    : [0, 0.01, 0.04, 0.07, 0.10, 0.12][level] ?? 0.02;

  if (blockers.length > 0 && Math.random() < bluffChance) {
    return rand(blockers);
  }

  return null;
}

// ── Challenge-block Decision (bot is actor, their action was blocked) ────────

/**
 * Should the bot challenge the blocker?
 */
function decideBotChallengeBlock(game, botId, level) {
  const pa = game.pendingAction;
  if (!pa || pa.actorId !== botId || !pa.blocker) return false;

  const base = [0, 0.04, 0.09, 0.17, 0.28, 0.44][level] ?? 0.05;
  const blocker = pa.blocker;

  let chance = base;
  if (level >= 3 && blocker.character) {
    const susp = suspicionScore(game, botId, blocker.character);
    chance = Math.min(0.88, base + susp * [0, 0, 0.10, 0.22, 0.38, 0.52][level]);
  }

  return Math.random() < chance;
}

// ── Challenge Won: swap or keep ───────────────────────────────────────────────

function decideChallengeWonSwap(game, botId, level) {
  if (level >= 3) return true;
  return Math.random() < 0.55;
}

// ── Lose Influence ────────────────────────────────────────────────────────────

function chooseLoseInfluence(game, botId, level) {
  const cards = botAliveCards(game, botId);
  if (cards.length === 0) return 0;
  if (cards.length === 1) return cards[0].idx;
  if (level <= 2) return rand(cards).idx;

  // Lose the least valuable card
  cards.sort((a, b) => (CHAR_VALUE[a.character] ?? 0) - (CHAR_VALUE[b.character] ?? 0));
  return cards[0].idx;
}

// ── Card Swap (trocar_carta) ──────────────────────────────────────────────────

function chooseBotCardSwap(game, botId, level) {
  const cards = botAliveCards(game, botId);
  if (cards.length === 0) return 0;
  if (level <= 2) return rand(cards).idx;
  cards.sort((a, b) => (CHAR_VALUE[a.character] ?? 0) - (CHAR_VALUE[b.character] ?? 0));
  return cards[0].idx; // swap least valuable
}

// ── Disfarce ──────────────────────────────────────────────────────────────────

/**
 * Returns { myCardIndex, pickedOption }
 * options = array of character strings offered to swap.
 */
function chooseBotDisfarce(game, botId, options, level) {
  const myCards = botAliveCards(game, botId);
  if (!options || options.length === 0 || myCards.length === 0) {
    return { myCardIndex: myCards[0]?.idx ?? 0, pickedOption: 0 };
  }

  if (level <= 2) {
    return { myCardIndex: rand(myCards).idx, pickedOption: Math.floor(Math.random() * options.length) };
  }

  // Swap worst own card for the best offered card
  const sortedMine = [...myCards].sort((a, b) => (CHAR_VALUE[a.character] ?? 0) - (CHAR_VALUE[b.character] ?? 0));
  const worstIdx = sortedMine[0].idx;

  let bestOptIdx = 0, bestOptVal = -1;
  options.forEach((char, i) => {
    const v = CHAR_VALUE[char] ?? 0;
    if (v > bestOptVal) { bestOptVal = v; bestOptIdx = i; }
  });

  // Only swap if it's actually an upgrade
  const worstVal = CHAR_VALUE[sortedMine[0].character] ?? 0;
  if (bestOptVal <= worstVal && level < 5) {
    // Not worth swapping at mid-level
    return { myCardIndex: rand(myCards).idx, pickedOption: Math.floor(Math.random() * options.length) };
  }

  return { myCardIndex: worstIdx, pickedOption: bestOptIdx };
}

// ── Card Show (meter_x9 target picks which card to reveal) ───────────────────

function chooseBotCardShow(game, botId, level) {
  const cards = botAliveCards(game, botId);
  if (cards.length === 0) return 0;
  if (level <= 2) return rand(cards).idx;
  // Show least valuable
  cards.sort((a, b) => (CHAR_VALUE[a.character] ?? 0) - (CHAR_VALUE[b.character] ?? 0));
  return cards[0].idx;
}

// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  BOT_COUNTS,
  BOT_DIFFICULTY_LEVELS,
  BOT_NAMES,
  getThinkDelay,
  chooseBotAction,
  decideBotChallenge,
  decideBotBlock,
  decideBotChallengeBlock,
  decideChallengeWonSwap,
  chooseLoseInfluence,
  chooseBotCardSwap,
  chooseBotDisfarce,
  chooseBotCardShow,
};
