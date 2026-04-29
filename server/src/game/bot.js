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

// Turn delay (ACTION_SELECT)
const TURN_DELAYS = {
  1: [2800, 4500],
  2: [2400, 4000],
  3: [2000, 3500],
  4: [1800, 3000],
  5: [1500, 2600],
};

// Reaction delay (challenge / block / lose-influence / etc.)
const REACT_DELAYS = {
  1: [2500, 4000],
  2: [2000, 3500],
  3: [1700, 3000],
  4: [1400, 2500],
  5: [1200, 2200],
};

// ── Personality profiles ─────────────────────────────────────────────────────
// Each level has a distinct playing style that changes action scoring,
// bluffing tendency, and target selection.
const PERSONALITY = {
  1: { // 🐣 Estagiário — medroso: only safe actions, never bluffs, never challenges
    bluffMult:  0.0,   // never bluffs
    safeMult:   2.2,   // loves renda/ajuda_externa
    aggroMult:  0.0,   // hates damage actions
    charBonus:  0.0,
    usesChars:  false, // never picks character actions
    targetLeader: false,
  },
  2: { // 📋 CLT — balanceado: standard play, modest bluffing
    bluffMult:  1.0,
    safeMult:   1.0,
    aggroMult:  1.0,
    charBonus:  0.0,
    usesChars:  true,
    targetLeader: false,
  },
  3: { // 💼 Patrão — agressivo: loves violence, coins > safety
    bluffMult:  1.1,
    safeMult:   0.45,  // rarely plays it safe
    aggroMult:  1.9,   // assassinar/golpe/veredito heavily preferred
    charBonus:  6.0,   // big bonus when using own card
    usesChars:  true,
    targetLeader: false,
  },
  4: { // 🏛️ Deputado — blefador: claims characters boldly even without cards
    bluffMult:  2.8,   // bluffs very aggressively
    safeMult:   0.6,
    aggroMult:  1.3,
    charBonus:  9.0,   // loves showing off
    usesChars:  true,
    targetLeader: true, // also targets the strongest player
  },
  5: { // 👑 Dono do Morro — mata líder: neutralises the richest/most powerful player
    bluffMult:  1.3,
    safeMult:   0.3,
    aggroMult:  2.1,
    charBonus:  5.0,
    usesChars:  true,
    targetLeader: true, // always aims at the leader (most coins + cards)
  },
};

const AGGRO_ACTIONS = new Set(['assassinar', 'golpe', 'veredito']);

// How much each character is "worth" (used for discard decisions)
const CHAR_VALUE = {
  guarda_costas: 6,
  investigador:  5,
  juiz:          4,
  assassino:     3,
  empresario:    2,
  politico:      1,
};

// ── Bot memory — persists across turns within a game ─────────────────────────
// Stored directly on the game object as game._botMemory = { [botId]: { [targetId]: char[] } }
// This avoids passing roomCode everywhere and GCs automatically with the game object.

/**
 * Record a card that botId has *seen* (via X9) on targetId.
 * `character` is the revealed card character key.
 */
function recordBotX9Memory(game, botId, targetId, character) {
  if (!game._botMemory)                   game._botMemory = {};
  if (!game._botMemory[botId])            game._botMemory[botId] = {};
  if (!game._botMemory[botId][targetId])  game._botMemory[botId][targetId] = [];
  const seen = game._botMemory[botId][targetId];
  if (!seen.includes(character)) seen.push(character);
}

/** Returns the list of characters the bot has seen on a target ([] if none). */
function getBotMemory(game, botId, targetId) {
  return game._botMemory?.[botId]?.[targetId] || [];
}

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

/**
 * Logic-based suspicion score — how confident is the bot that `actorId` is bluffing `char`?
 * Returns 0.0 (definitely has it) → 1.0 (definitely bluffing).
 *
 * Level 5 uses server-side omniscience (sees all cards directly).
 * Levels 2-4 reason from dead cards + own hand.
 */
function advancedSuspicionScore(game, botId, actorId, char, level) {
  const dead = countDeadChar(game, char);
  const own  = botCharacters(game, botId).filter(c => c === char).length;

  // ── Memory check (levels 4-5): bot remembers cards seen via X9 ───────────
  if (level >= 4) {
    const seenOnActor = getBotMemory(game, botId, actorId);
    if (seenOnActor.length > 0) {
      if (seenOnActor.includes(char)) return 0.02; // bot saw this exact card → definitely legit
      // Bot saw one or more of actor's cards but NOT this char.
      // If actor has only 1 alive card and it wasn't char, this is a definite bluff.
      const actorAlive = (getPlayer(game, actorId)?.cards || []).filter(c => !c.dead).length;
      if (actorAlive === 1) return 0.92; // single card known to be something else
      if (actorAlive === 2 && seenOnActor.length >= 1) return 0.62; // saw one card, it wasn't char
    }
  }

  // ── Level 5 (Dono do Morro): reads all live cards on server ──────────────
  if (level >= 5) {
    const actor = game.players.find(p => p.id === actorId);
    if (actor) {
      const actorHasIt = actor.cards.some(c => !c.dead && c.character === char);
      if (actorHasIt) return 0.02; // knows for certain → don't challenge
    }
    // Count copies held by other non-bot, non-actor players
    let takenElsewhere = 0;
    game.players.forEach(p => {
      if (p.id === botId || p.id === actorId) return;
      p.cards.forEach(c => { if (!c.dead && c.character === char) takenElsewhere++; });
    });
    const remaining = 3 - dead - own - takenElsewhere;
    if (remaining <= 0) return 0.97; // every copy accounted for — definite bluff
    return remaining === 1 ? 0.22 : 0.08;
  }

  // ── Levels 2-4: reason from observable info ───────────────────────────────
  const remaining = 3 - dead - own;
  if (remaining <= 0) return 0.95; // all copies dead or in bot's hand
  if (own >= 2)       return 0.85; // bot holds 2 copies; actor could have at most 1
  if (own >= 1)       return 0.42; // bot holds 1 copy; reduced pool
  if (dead >= 2)      return 0.52; // only 1 copy unaccounted; still possible but suspicious
  return 0.10;                     // normal: no special information
}

/**
 * Can the bot plausibly bluff `character`?
 * Returns false if all 3 copies are dead or already in the bot's hand —
 * claiming it would be logically impossible and should never happen.
 */
function canBluff(game, botId, character) {
  const dead = countDeadChar(game, character);
  const own  = botCharacters(game, botId).filter(c => c === character).length;
  return (3 - dead - own) > 0; // at least 1 copy could plausibly be elsewhere
}

// ── Public: think delays ──────────────────────────────────────────────────────

function getTurnDelay(difficultyLevel) {
  const [mn, mx] = TURN_DELAYS[difficultyLevel] || TURN_DELAYS[1];
  return mn + Math.floor(Math.random() * (mx - mn));
}

function getReactDelay(difficultyLevel) {
  const [mn, mx] = REACT_DELAYS[difficultyLevel] || REACT_DELAYS[1];
  return mn + Math.floor(Math.random() * (mx - mn));
}

/** @deprecated use getTurnDelay / getReactDelay */
function getThinkDelay(difficultyLevel) {
  return getReactDelay(difficultyLevel);
}

// ── Action Selection ──────────────────────────────────────────────────────────

/**
 * Choose an action + optional targetId for the bot's turn.
 * Returns { action: string, targetId: string|null }
 */
function chooseBotAction(game, botId, level) {
  const coins   = botCoins(game, botId);
  const chars   = botCharacters(game, botId);
  const alive   = getAlivePlayers(game).filter(p => p.id !== botId);
  const persona = PERSONALITY[level] || PERSONALITY[2];

  // Forced golpe at ≥10 coins
  if (coins >= 10 && alive.length > 0) {
    return { action: 'golpe', targetId: pickTarget(alive, level).id };
  }

  const candidates = [];

  // ── Basic actions ────────────────────────────────────────────────────────
  candidates.push({ action: 'renda',        targetId: null, score: scoreBasic('renda',        coins, level) * persona.safeMult });
  candidates.push({ action: 'ajuda_externa', targetId: null, score: scoreBasic('ajuda_externa', coins, level) * persona.safeMult });

  if (coins >= 7 && alive.length > 0) {
    const golpeBase = 78 + level * 4;
    candidates.push({ action: 'golpe', targetId: pickTarget(alive, level).id, score: golpeBase * persona.aggroMult });
  }

  // ── Character actions (real cards or bluffs) ─────────────────────────────
  // Estagiário (level 1) never uses character actions — persona.usesChars = false
  if (persona.usesChars) {
    tryCharAction(candidates, game, botId, 'politico',     'taxar',        null,           chars, coins, alive, level, persona);
    tryCharAction(candidates, game, botId, 'empresario',   'roubar',       'target_coins', chars, coins, alive, level, persona);
    tryCharAction(candidates, game, botId, 'assassino',    'assassinar',   'any',          chars, coins, alive, level, persona);
    tryCharAction(candidates, game, botId, 'juiz',         'veredito',     'any',          chars, coins, alive, level, persona);
    tryCharAction(candidates, game, botId, 'investigador', 'meter_x9',     'any',          chars, coins, alive, level, persona);
    tryCharAction(candidates, game, botId, 'investigador', 'disfarce',     null,           chars, coins, alive, level, persona);
    tryCharAction(candidates, game, botId, 'investigador', 'trocar_carta', 'any',          chars, coins, alive, level, persona);
  }

  const valid = candidates.filter(c => c.targetId !== '__SKIP__');
  if (valid.length === 0) return { action: 'renda', targetId: null };

  const picked = weightedPick(valid, level);

  // Veredito: bot must accuse the target of having a specific character
  if (picked.action === 'veredito' && picked.targetId) {
    picked.accusedCharacter = chooseBotVeredito(game, botId, picked.targetId, level);
    if (!picked.accusedCharacter) return { action: 'renda', targetId: null }; // fallback
  }

  return picked;
}

function scoreBasic(action, coins, level) {
  // Renda / ajuda_externa become less attractive as coins grow (at higher levels)
  if (level <= 2) return action === 'renda' ? 22 : 18;
  return Math.max(6, 28 - coins * 3);
}

function tryCharAction(candidates, game, botId, character, action, targetMode, chars, coins, alive, level, persona) {
  const def = ACTION_DEFS[action];
  if (!def) return;
  if (def.cost && coins < def.cost) return;
  if (def.requiresTarget && alive.length === 0) return;

  const hasChar     = chars.includes(character);
  const rawBluff    = [0, 0.0, 0.12, 0.28, 0.44, 0.60][level] ?? 0.10;
  const bluffChance = rawBluff * persona.bluffMult;

  if (!hasChar) {
    // Logic check: never claim a character if all copies are verifiably dead/in hand
    if (!canBluff(game, botId, character)) return;
    // Personality/level gate
    if (Math.random() > bluffChance) return;
  }

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

  // Base score
  let base = hasChar
    ? ([0, 38, 52, 62, 68, 74][level] ?? 50) + persona.charBonus
    : ([0,  0, 22, 32, 42, 52][level] ?? 20);

  // Aggro multiplier for damage actions (assassinar, golpe, veredito)
  if (AGGRO_ACTIONS.has(action)) base *= persona.aggroMult;

  // Safety gate: aggressive bots still respect coin costs
  candidates.push({ action, targetId, score: base + Math.random() * 8 });
}

/**
 * Decide which character to accuse the target of having for Veredito.
 * Level 5 can read the actual cards; lower levels use memory + guess.
 */
function chooseBotVeredito(game, botId, targetId, level) {
  const ALL_CHARS = ['politico', 'empresario', 'investigador', 'juiz', 'assassino', 'guarda_costas'];
  const target = getPlayer(game, targetId);
  if (!target) return null;
  const targetAlive = target.cards.filter(c => !c.dead);
  if (targetAlive.length === 0) return null;

  // Level 5: omniscient — pick most valuable alive card of target
  if (level >= 5) {
    const best = [...targetAlive].sort((a, b) => (CHAR_VALUE[b.character] ?? 0) - (CHAR_VALUE[a.character] ?? 0));
    return best[0].character;
  }

  // Level 4: use X9 memory if available
  if (level >= 4) {
    const seen = getBotMemory(game, botId, targetId);
    if (seen.length > 0) {
      // Verify the remembered card is still alive (could have been lost)
      const stillAlive = seen.find(ch => targetAlive.some(c => c.character === ch));
      if (stillAlive) return stillAlive;
    }
  }

  // Levels 2-3: guess a plausible character (avoid ones known-dead or in own hand)
  const botChars = botCharacters(game, botId);
  const plausible = ALL_CHARS.filter(ch => {
    const dead = countDeadChar(game, ch);
    const own = botChars.filter(c => c === ch).length;
    return (3 - dead - own) > 0;
  });

  if (plausible.length === 0) return rand(ALL_CHARS);

  // Prefer high-value characters as accusation (more damage if correct)
  if (level >= 3) {
    plausible.sort((a, b) => (CHAR_VALUE[b] ?? 0) - (CHAR_VALUE[a] ?? 0));
    return plausible[0];
  }

  return rand(plausible);
}

function pickTarget(alivePlayers, level) {
  if (alivePlayers.length === 0) return null;
  if (alivePlayers.length === 1) return alivePlayers[0];

  // ── 👑 Dono do Morro: always targets the leader (richest / most cards) ────
  if (level === 5) {
    return [...alivePlayers].sort((a, b) => {
      const aLive = a.cards.filter(c => !c.dead).length;
      const bLive = b.cards.filter(c => !c.dead).length;
      if (bLive !== aLive) return bLive - aLive; // most alive cards first
      return b.coins - a.coins;                  // tiebreak: most coins
    })[0];
  }

  // ── Human focus bias (bots gang up on the human player) ──────────────────
  // Level 1: 0%, 2: 20%, 3: 50%, 4: 78%
  const humanBias = [0, 0.00, 0.20, 0.50, 0.78][level] ?? 0;
  const humans = alivePlayers.filter(p => !p.isBot);

  if (humans.length > 0 && Math.random() < humanBias) {
    return humans[0]; // only one human in PvE
  }

  // ── Fallback: most dangerous at level 4+, random otherwise ───────────────
  if (level >= 4) {
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
 *
 * Decision is now suspicion-threshold-based, not purely random:
 *   - High suspicion (e.g. all copies dead) → challenge with high probability
 *   - Low suspicion → almost never challenge
 * Level 5 uses server-side card knowledge for near-perfect decisions.
 */
function decideBotChallenge(game, botId, level) {
  const pa = game.pendingAction;
  if (!pa) return false;
  const def = ACTION_DEFS[pa.type];
  if (!def?.challengeable) return false;
  if (pa.respondedPlayers?.includes(botId)) return false;

  // 🐣 Estagiário: never challenges
  if (level === 1) return false;

  // No claimed character → nothing to logically contest
  if (!pa.claimedCharacter) return false;

  const susp = advancedSuspicionScore(game, botId, pa.actorId, pa.claimedCharacter, level);

  // ── Near-certain bluff (≥0.85): actor almost definitely lying ────────────
  // Lv2: 42%, Lv3: 70%, Lv4: 90%, Lv5: 98%
  if (susp >= 0.85) {
    const rate = [0, 0, 0.42, 0.70, 0.90, 0.98][level] ?? 0.70;
    return Math.random() < rate;
  }

  // ── Medium suspicion (0.40–0.85): suspicious but not certain ─────────────
  // Lv2: 7%, Lv3: 18%, Lv4: 36%, Lv5: 55%
  if (susp >= 0.40) {
    const rate = [0, 0, 0.07, 0.18, 0.36, 0.55][level] ?? 0.12;
    return Math.random() < rate;
  }

  // ── Low suspicion: rare gut-feeling challenge ─────────────────────────────
  // Lv2: 1%, Lv3: 3%, Lv4: 5%, Lv5: 7%
  const rate = [0, 0, 0.01, 0.03, 0.05, 0.07][level] ?? 0.01;
  return Math.random() < rate;
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

  // 🐣 Estagiário: very low legit block rate (too scared even with the right card)
  const legitChance = isTarget
    ? [0, 0.20, 0.68, 0.82, 0.92, 0.97][level] ?? 0.50
    : [0, 0.08, 0.40, 0.58, 0.74, 0.88][level] ?? 0.28;

  if (legit.length > 0 && Math.random() < legitChance) {
    return rand(legit);
  }

  // Bluff block — rare, 🐣 Estagiário never bluff-blocks
  const bluffChance = isTarget
    ? [0, 0.00, 0.03, 0.06, 0.10, 0.14][level] ?? 0.02
    : [0, 0.00, 0.01, 0.02, 0.04, 0.06][level] ?? 0.01;

  if (Math.random() < bluffChance) {
    // Only bluff-block with characters that still have unaccounted copies
    // (bluffing a dead character is logically impossible and should never happen)
    const viable = blockers.filter(b => canBluff(game, botId, b));
    if (viable.length > 0) return rand(viable);
  }

  return null;
}

// ── Challenge-block Decision (bot is actor, their action was blocked) ────────

/**
 * Should the bot challenge the blocker?
 * Uses the same suspicion-threshold logic as decideBotChallenge.
 */
function decideBotChallengeBlock(game, botId, level) {
  const pa = game.pendingAction;
  if (!pa || pa.actorId !== botId || !pa.blocker) return false;

  // 🐣 Estagiário: accepts all blocks, too scared to push back
  if (level === 1) return false;

  const blockerId   = pa.blocker.playerId;
  const blockerChar = pa.blocker.character;
  if (!blockerChar) {
    // No claimed character — small base chance to challenge anyway
    const base = [0, 0, 0.06, 0.14, 0.24, 0.38][level] ?? 0.10;
    return Math.random() < base;
  }

  const susp = advancedSuspicionScore(game, botId, blockerId, blockerChar, level);

  // Near-certain bluff (≥0.85)
  if (susp >= 0.85) {
    const rate = [0, 0, 0.35, 0.65, 0.86, 0.96][level] ?? 0.65;
    return Math.random() < rate;
  }
  // Medium (0.40–0.85)
  if (susp >= 0.40) {
    const rate = [0, 0, 0.10, 0.26, 0.44, 0.62][level] ?? 0.20;
    return Math.random() < rate;
  }
  // Low — base acceptance rate
  const base = [0, 0, 0.02, 0.07, 0.14, 0.26][level] ?? 0.04;
  return Math.random() < base;
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
  getTurnDelay,
  getReactDelay,
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
  recordBotX9Memory,
};
