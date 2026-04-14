const { shuffle } = require('./deck');
const { ACTION_DEFS, ACTION_NAMES, CHARACTER_NAMES, getBlockers } = require('./actions');

// ── Funny logs ────────────────────────────────────────────────────────────────
const FUNNY = {
  renda:        (a)    => `${a} foi no trampo suado e ganhou 1 real 😤`,
  ajuda_externa:(a)    => `${a} declarou que imposto é roubo e pegou mais 2 moedas 💸`,
  golpe:        (a, t) => `${a} deu o Golpe em ${t}! O Brasil não é pra amadores 🪖`,
  taxar:        (a)    => `${a} fez o L na galera e taxou 3 moedas do banco 🤙`,
  roubar:       (a, t) => `${a} tá querendo demais e tentou Pegar o Arrego de ${t}! 🤑`,
  assassinar:   (a, t) => `${a} mandou ${t} pro Vasco! F no chat ⚰️`,
  meter_x9:     (a, t) => `${a} meteu o X9 em ${t}! Cê tá sendo investigado 👀`,
  disfarce:     (a)    => `${a} botou o disfarce! Mas será que alguém acredita? 🎭`,
  trocar_carta: (a, t) => `${a} forçou ${t} a trocar uma carta! Não é justo, mas é o Golpe 🔄`,
  challenge_success: (c, a) => `${c} DUVIDOU e acertou! ${a} tava blefando igual político em campanha 🤥 O clima esquentou, chamem o VAR!`,
  challenge_fail:    (c, a) => `${c} DUVIDOU e se deu mal! ${a} tinha a carta mesmo. Passou vergonha na mesa 😳`,
  block:             (b, act) => `${b} bloqueou a jogada! Ninguém passa fácil aqui 🛡️`,
  block_accepted:    (a)    => `${a} aceitou o bloqueio. Covardia? Estratégia? 🤷`,
  block_challenge_success: (c, b) => `${c} descobriu o blefe de ${b}! Tá tudo gravado, brother 📹`,
  block_challenge_fail:    (c, b) => `${c} duvidou do bloqueio e se arrependeu. ${b} tinha mesmo 😎`,
  lose_influence: (p, ch)  => `${p} perdeu ${ch}. F no chat ⚰️`,
  eliminated:     (p)      => `${p} tá eliminado! Foi pro Vasco definitivamente 👋`,
  turn_start:     (p)      => `--- Vez de ${p}. Bora ver o que essa pessoa vai aprontar... 🤔`,
  game_start:     ()       => `🇧🇷 PARTIDA INICIADA! Que vença o mais safado. Boa sorte pra ninguém.`,
  x9_show:        (t)      => `${t} selecionou uma carta para mostrar. O X9 vai ver... 🕵️`,
  x9_swap_done:   (p)      => `${p} trocou uma carta. Será que melhorou? 🎴`,
};

function log(game, msg) {
  game.log.push(msg);
  if (game.log.length > 100) game.log.shift();
}

function getAlivePlayers(game) {
  return game.players.filter(p => p.cards.some(c => !c.dead));
}
function getPlayer(game, id) { return game.players.find(p => p.id === id); }

function checkGameOver(game) {
  const alive = getAlivePlayers(game);
  if (alive.length === 1) {
    game.winner = alive[0].id;
    game.phase = 'GAME_OVER';
    log(game, `🏆 ${alive[0].name} venceu o Golpe! Parabéns ao mais safado 🇧🇷`);
    return true;
  }
  return false;
}

function advanceTurn(game) {
  if (checkGameOver(game)) return;
  const alive = getAlivePlayers(game);
  const idx = alive.findIndex(p => p.id === game.currentPlayerId);
  const next = alive[(idx + 1) % alive.length];
  game.currentPlayerId = next.id;
  game.phase = 'ACTION_SELECT';
  game.pendingAction = null;
  log(game, FUNNY.turn_start(next.name));
}

function checkResponseWindowComplete(game) {
  const pa = game.pendingAction;
  const eligible = getAlivePlayers(game).filter(p => p.id !== pa.actorId);
  return eligible.every(p => pa.respondedPlayers.includes(p.id));
}

function resolveActionEffect(game) {
  const pa = game.pendingAction;
  const { type, actorId, targetId } = pa;
  const actor = getPlayer(game, actorId);

  switch (type) {
    case 'renda':
      actor.coins += 1;
      log(game, FUNNY.renda(actor.name));
      break;

    case 'ajuda_externa':
      actor.coins += 2;
      log(game, FUNNY.ajuda_externa(actor.name));
      break;

    case 'taxar':
      actor.coins += 3;
      log(game, FUNNY.taxar(actor.name));
      break;

    case 'roubar': {
      const target = getPlayer(game, targetId);
      const stolen = Math.min(2, target.coins);
      target.coins -= stolen;
      actor.coins += stolen;
      log(game, FUNNY.roubar(actor.name, target.name) + ` (${stolen} moeda${stolen !== 1 ? 's' : ''})`);
      break;
    }

    case 'golpe':
    case 'assassinar': {
      const target = getPlayer(game, targetId);
      if (type === 'golpe') log(game, FUNNY.golpe(actor.name, target.name));
      else log(game, FUNNY.assassinar(actor.name, target.name));
      pa.loseInfluenceQueue.push({ playerId: targetId });
      game.phase = 'LOSE_INFLUENCE';
      return;
    }

    case 'meter_x9': {
      const target = getPlayer(game, targetId);
      log(game, FUNNY.meter_x9(actor.name, target.name));
      game.phase = 'X9_PEEK_SELECT';
      return;
    }

    case 'disfarce': {
      log(game, FUNNY.disfarce(actor.name));
      pa.swapPlayerId = actorId;
      pa.swapContext = 'disfarce';
      game.phase = 'CARD_SWAP_SELECT';
      return;
    }

    case 'trocar_carta': {
      const target = getPlayer(game, targetId);
      log(game, FUNNY.trocar_carta(actor.name, target.name));
      pa.swapPlayerId = targetId;
      pa.swapContext = 'trocar_carta';
      game.phase = 'CARD_SWAP_SELECT';
      return;
    }
  }
  advanceTurn(game);
}

// ── Public handlers ──────────────────────────────────────────────────────────

function handleAction(room, actorId, actionType, targetId) {
  const game = room.game;
  if (game.phase !== 'ACTION_SELECT') return { success: false, error: 'Fase incorreta' };
  if (game.currentPlayerId !== actorId) return { success: false, error: 'Não é sua vez' };

  const def = ACTION_DEFS[actionType];
  if (!def) return { success: false, error: 'Ação inválida' };

  const actor = getPlayer(game, actorId);
  if (def.cost && actor.coins < def.cost) return { success: false, error: 'Moedas insuficientes' };
  if (actor.coins >= 10 && actionType !== 'golpe') return { success: false, error: 'Com 10+ moedas é obrigatório usar Golpe de Estado' };
  if (def.requiresTarget && !targetId) return { success: false, error: 'Escolha um alvo primeiro' };
  if (targetId) {
    const t = getPlayer(game, targetId);
    if (!t || !t.cards.some(c => !c.dead)) return { success: false, error: 'Alvo inválido' };
  }

  if (def.cost) actor.coins -= def.cost;

  game.pendingAction = {
    type: actionType, actorId, targetId: targetId || null,
    claimedCharacter: def.character || null,
    blocker: null, respondedPlayers: [], loseInfluenceQueue: [],
  };

  const tName = targetId ? getPlayer(game, targetId)?.name : null;
  log(game, `${actor.name} declara: ${ACTION_NAMES[actionType]}${tName ? ` → ${tName}` : ''}`);

  if (!def.challengeable && !def.blockable) {
    resolveActionEffect(game);
    return { success: true };
  }
  game.phase = 'RESPONSE_WINDOW';
  return { success: true };
}

function handlePass(room, playerId) {
  const game = room.game;
  const pa = game.pendingAction;
  if (!pa) return { success: false };

  if (game.phase === 'RESPONSE_WINDOW') {
    if (!pa.respondedPlayers.includes(playerId)) pa.respondedPlayers.push(playerId);
    if (checkResponseWindowComplete(game)) resolveActionEffect(game);
    return { success: true };
  }

  if (game.phase === 'BLOCK_CHALLENGE_WINDOW' && playerId === pa.actorId) {
    log(game, FUNNY.block_accepted(getPlayer(game, pa.actorId).name));
    advanceTurn(game);
    return { success: true };
  }
  return { success: true };
}

function handleBlock(room, blockerId, claimedCharacter) {
  const game = room.game;
  const pa = game.pendingAction;
  if (!pa || game.phase !== 'RESPONSE_WINDOW') return { success: false, error: 'Não é possível bloquear agora' };

  const def = ACTION_DEFS[pa.type];
  if (!def.blockable) return { success: false, error: 'Ação não pode ser bloqueada' };
  if (!getBlockers(pa.type).includes(claimedCharacter)) return { success: false, error: 'Personagem não bloqueia isso' };
  if (!def.anyoneCanBlock && blockerId !== pa.targetId) return { success: false, error: 'Apenas o alvo pode bloquear' };

  pa.blocker = { playerId: blockerId, character: claimedCharacter };
  game.phase = 'BLOCK_CHALLENGE_WINDOW';
  log(game, FUNNY.block(getPlayer(game, blockerId).name, ACTION_NAMES[pa.type]));
  return { success: true };
}

function handleChallenge(room, challengerId) {
  const game = room.game;
  const pa = game.pendingAction;
  if (!pa) return { success: false };

  const challenger = getPlayer(game, challengerId);

  // ── Challenge the action ──────────────────────────────────────────────────
  if (game.phase === 'RESPONSE_WINDOW') {
    if (!pa.claimedCharacter) return { success: false, error: 'Ação não pode ser desafiada' };
    if (challengerId === pa.actorId) return { success: false, error: 'Não pode se desafiar' };
    // For targeted actions only the target may challenge
    const def = ACTION_DEFS[pa.type];
    if (def.requiresTarget && pa.targetId && challengerId !== pa.targetId)
      return { success: false, error: 'Só o alvo pode duvidar desta ação' };

    const actor = getPlayer(game, pa.actorId);
    const cardIdx = actor.cards.findIndex(c => !c.dead && c.character === pa.claimedCharacter);

    if (cardIdx !== -1) {
      // Actor had it — challenger loses, action continues
      log(game, FUNNY.challenge_fail(challenger.name, actor.name));
      const char = actor.cards[cardIdx].character;
      game.deck.push(char); shuffle(game.deck);
      actor.cards[cardIdx].character = game.deck.pop();
      pa.loseInfluenceQueue.push({ playerId: challengerId });
      pa._afterLose = 'continue_action';
      game.phase = 'LOSE_INFLUENCE';
    } else {
      // Bluff caught — actor loses, action cancelled
      log(game, FUNNY.challenge_success(challenger.name, actor.name));
      pa.loseInfluenceQueue.push({ playerId: pa.actorId });
      pa._afterLose = 'cancel_action';
      game.phase = 'LOSE_INFLUENCE';
    }
    return { success: true };
  }

  // ── Challenge the block ───────────────────────────────────────────────────
  if (game.phase === 'BLOCK_CHALLENGE_WINDOW') {
    if (challengerId !== pa.actorId) return { success: false, error: 'Só quem foi bloqueado pode desafiar o bloqueio' };

    const { playerId: blockerId, character: blockerChar } = pa.blocker;
    const blocker = getPlayer(game, blockerId);
    const cardIdx = blocker.cards.findIndex(c => !c.dead && c.character === blockerChar);

    if (cardIdx !== -1) {
      // Blocker had it — challenger loses, block stands
      log(game, FUNNY.block_challenge_fail(challenger.name, blocker.name));
      const char = blocker.cards[cardIdx].character;
      game.deck.push(char); shuffle(game.deck);
      blocker.cards[cardIdx].character = game.deck.pop();
      pa.loseInfluenceQueue.push({ playerId: challengerId });
      pa._afterLose = 'block_stands';
      game.phase = 'LOSE_INFLUENCE';
    } else {
      // Block was bluff — blocker loses, action proceeds
      log(game, FUNNY.block_challenge_success(challenger.name, blocker.name));
      pa.loseInfluenceQueue.push({ playerId: blockerId });
      pa._afterLose = 'action_proceeds';
      game.phase = 'LOSE_INFLUENCE';
    }
    return { success: true };
  }
  return { success: false };
}

function handleLoseInfluence(room, playerId, cardIndex) {
  const game = room.game;
  const pa = game.pendingAction;
  if (game.phase !== 'LOSE_INFLUENCE' || !pa) return { success: false };

  const queue = pa.loseInfluenceQueue;
  if (!queue.length || queue[0].playerId !== playerId) return { success: false, error: 'Não é você que deve perder influência' };

  const player = getPlayer(game, playerId);
  const card = player.cards[cardIndex];
  if (!card || card.dead) return { success: false, error: 'Carta inválida' };

  card.dead = true;
  log(game, FUNNY.lose_influence(player.name, CHARACTER_NAMES[card.character]));
  queue.shift();

  if (checkGameOver(game)) return { success: true };
  if (queue.length > 0) return { success: true };

  const flag = pa._afterLose;
  delete pa._afterLose;

  if (flag === 'continue_action')  resolveActionEffect(game);
  else if (flag === 'cancel_action')  advanceTurn(game);
  else if (flag === 'block_stands')   advanceTurn(game);
  else if (flag === 'action_proceeds') resolveActionEffect(game);
  else advanceTurn(game);

  return { success: true };
}

// ── X9 specific handlers ─────────────────────────────────────────────────────

function handleSelectCardShow(room, playerId, cardIndex) {
  const game = room.game;
  const pa = game.pendingAction;
  if (game.phase !== 'X9_PEEK_SELECT') return { success: false, error: 'Fase incorreta' };
  if (pa.targetId !== playerId) return { success: false, error: 'Você não é o alvo' };

  const target = getPlayer(game, playerId);
  const card = target.cards[cardIndex];
  if (!card || card.dead) return { success: false, error: 'Carta inválida' };

  // Store privately — sanitized out for everyone except actor
  pa.x9Result = { character: card.character, cardIndex };
  game.phase = 'X9_PEEK_VIEW';
  log(game, FUNNY.x9_show(target.name));
  return { success: true };
}

function handleAcknowledgePeek(room, actorId) {
  const game = room.game;
  const pa = game.pendingAction;
  if (game.phase !== 'X9_PEEK_VIEW') return { success: false };
  if (pa.actorId !== actorId) return { success: false, error: 'Só o investigador pode confirmar' };

  delete pa.x9Result;
  advanceTurn(game);
  return { success: true };
}

function handleSelectCardSwap(room, playerId, cardIndex) {
  const game = room.game;
  const pa = game.pendingAction;
  if (game.phase !== 'CARD_SWAP_SELECT') return { success: false, error: 'Fase incorreta' };
  if (pa.swapPlayerId !== playerId) return { success: false, error: 'Não é você que deve trocar' };

  const player = getPlayer(game, playerId);
  const card = player.cards[cardIndex];
  if (!card || card.dead) return { success: false, error: 'Carta inválida' };

  const old = card.character;
  game.deck.push(old); shuffle(game.deck);
  card.character = game.deck.pop();

  log(game, FUNNY.x9_swap_done(player.name));
  advanceTurn(game);
  return { success: true };
}

module.exports = {
  handleAction, handlePass, handleBlock, handleChallenge,
  handleLoseInfluence, handleSelectCardShow, handleAcknowledgePeek, handleSelectCardSwap,
};
