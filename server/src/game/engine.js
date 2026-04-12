const { shuffle } = require('./deck');
const { ACTION_DEFS, ACTION_NAMES, CHARACTER_NAMES, getBlockers } = require('./actions');

function getAlivePlayers(game) {
  return game.players.filter(p => p.cards.some(c => !c.dead));
}

function getPlayer(game, id) {
  return game.players.find(p => p.id === id);
}

function addLog(game, msg) {
  game.log.push(msg);
  if (game.log.length > 100) game.log.shift();
}

function checkGameOver(game) {
  const alive = getAlivePlayers(game);
  if (alive.length === 1) {
    game.winner = alive[0].id;
    game.phase = 'GAME_OVER';
    addLog(game, `🏆 ${alive[0].name} venceu o jogo!`);
    return true;
  }
  return false;
}

function advanceTurn(game) {
  if (checkGameOver(game)) return;
  const alive = getAlivePlayers(game);
  const currentIdx = alive.findIndex(p => p.id === game.currentPlayerId);
  const nextIdx = (currentIdx + 1) % alive.length;
  game.currentPlayerId = alive[nextIdx].id;
  game.phase = 'ACTION_SELECT';
  game.pendingAction = null;
  addLog(game, `--- Vez de ${alive[nextIdx].name} ---`);
}

function resolveActionEffect(game) {
  const pa = game.pendingAction;
  const { type: actionType, actorId, targetId } = pa;
  const actor = getPlayer(game, actorId);

  switch (actionType) {
    case 'renda':
      actor.coins += 1;
      addLog(game, `${actor.name} recebeu Renda (+1 moeda)`);
      break;
    case 'ajuda_externa':
      actor.coins += 2;
      addLog(game, `${actor.name} recebeu Ajuda Externa (+2 moedas)`);
      break;
    case 'taxar':
      actor.coins += 3;
      addLog(game, `${actor.name} taxou (+3 moedas)`);
      break;
    case 'roubar': {
      const target = getPlayer(game, targetId);
      const stolen = Math.min(2, target.coins);
      target.coins -= stolen;
      actor.coins += stolen;
      addLog(game, `${actor.name} roubou ${stolen} moeda(s) de ${target.name}`);
      break;
    }
    case 'golpe':
    case 'assassinar': {
      const target = getPlayer(game, targetId);
      addLog(game, `${actor.name} elimina uma influência de ${target.name}`);
      pa.loseInfluenceQueue.push({ playerId: targetId });
      game.phase = 'LOSE_INFLUENCE';
      return; // don't advance yet
    }
    case 'investigar': {
      const target = getPlayer(game, targetId);
      const aliveCards = target.cards.map((c, i) => ({ ...c, index: i })).filter(c => !c.dead);
      // Pick a random alive card to peek at (server decides, actor sees privately)
      const peeked = aliveCards[Math.floor(Math.random() * aliveCards.length)];
      pa.investigationPeek = { cardIndex: peeked.index, character: peeked.character, targetId };
      game.phase = 'INVESTIGATE_DECISION';
      addLog(game, `${actor.name} investiga ${target.name}`);
      return; // actor needs to decide: swap or keep
    }
  }

  // For non-lose-influence actions, advance turn
  advanceTurn(game);
}

function checkResponseWindowComplete(game) {
  const pa = game.pendingAction;
  const eligible = getAlivePlayers(game).filter(p => p.id !== pa.actorId);
  return eligible.every(p => pa.respondedPlayers.includes(p.id));
}

// ─── Public handlers ────────────────────────────────────────────────────────

function handleAction(room, actorId, actionType, targetId) {
  const game = room.game;

  if (game.phase !== 'ACTION_SELECT') return { success: false, error: 'Fase incorreta' };
  if (game.currentPlayerId !== actorId) return { success: false, error: 'Não é sua vez' };

  const def = ACTION_DEFS[actionType];
  if (!def) return { success: false, error: 'Ação inválida' };

  const actor = getPlayer(game, actorId);

  if (def.cost && actor.coins < def.cost) return { success: false, error: 'Moedas insuficientes' };
  if (actor.coins >= 10 && actionType !== 'golpe') return { success: false, error: 'Com 10+ moedas é obrigatório usar Golpe' };
  if (def.requiresTarget && !targetId) return { success: false, error: 'Escolha um alvo' };
  if (targetId) {
    const target = getPlayer(game, targetId);
    if (!target || !target.cards.some(c => !c.dead)) return { success: false, error: 'Alvo inválido ou eliminado' };
  }

  // Deduct cost upfront
  if (def.cost) actor.coins -= def.cost;

  game.pendingAction = {
    type: actionType,
    actorId,
    targetId: targetId || null,
    claimedCharacter: def.character || null,
    blocker: null,
    respondedPlayers: [],
    loseInfluenceQueue: [],
  };

  addLog(game, `${actor.name} declara ${ACTION_NAMES[actionType]}${targetId ? ` → ${getPlayer(game, targetId).name}` : ''}`);

  // Actions with no possible response resolve immediately
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

  if (game.phase === 'BLOCK_CHALLENGE_WINDOW') {
    // Only the actor passes on challenging the block
    if (playerId === pa.actorId) {
      addLog(game, `${getPlayer(game, pa.actorId).name} aceita o bloqueio`);
      advanceTurn(game);
    }
    return { success: true };
  }

  return { success: false };
}

function handleBlock(room, blockerId, claimedCharacter) {
  const game = room.game;
  const pa = game.pendingAction;
  if (!pa || game.phase !== 'RESPONSE_WINDOW') return { success: false, error: 'Não é possível bloquear agora' };

  const def = ACTION_DEFS[pa.type];
  if (!def.blockable) return { success: false, error: 'Esta ação não pode ser bloqueada' };

  const blockers = getBlockers(pa.type);
  if (!blockers.includes(claimedCharacter)) return { success: false, error: 'Este personagem não bloqueia esta ação' };

  // Only target can block theft/assassination; anyone can block foreign aid
  if (!def.anyoneCanBlock && blockerId !== pa.targetId) {
    return { success: false, error: 'Apenas o alvo pode bloquear esta ação' };
  }

  const blocker = getPlayer(game, blockerId);
  pa.blocker = { playerId: blockerId, character: claimedCharacter };
  game.phase = 'BLOCK_CHALLENGE_WINDOW';
  addLog(game, `${blocker.name} bloqueia como ${CHARACTER_NAMES[claimedCharacter]}`);
  return { success: true };
}

function handleChallenge(room, challengerId) {
  const game = room.game;
  const pa = game.pendingAction;
  if (!pa) return { success: false };

  const challenger = getPlayer(game, challengerId);

  // ── Challenge the actor's claimed character ──────────────────────────────
  if (game.phase === 'RESPONSE_WINDOW') {
    if (!pa.claimedCharacter) return { success: false, error: 'Não há personagem para desafiar' };
    if (challengerId === pa.actorId) return { success: false, error: 'Não pode se desafiar' };

    const actor = getPlayer(game, pa.actorId);
    const cardIdx = actor.cards.findIndex(c => !c.dead && c.character === pa.claimedCharacter);
    const actorHasCard = cardIdx !== -1;

    addLog(game, `⚔️ ${challenger.name} DUVIDA de ${actor.name}!`);

    if (actorHasCard) {
      addLog(game, `${actor.name} revela ${CHARACTER_NAMES[pa.claimedCharacter]} — ${challenger.name} perde influência!`);
      // Shuffle revealed card back, draw new one
      const char = actor.cards[cardIdx].character;
      game.deck.push(char);
      shuffle(game.deck);
      actor.cards[cardIdx].character = game.deck.pop();
      // Challenger loses influence; action still proceeds
      pa.loseInfluenceQueue.push({ playerId: challengerId });
      pa._afterLose = 'continue_action';
      game.phase = 'LOSE_INFLUENCE';
    } else {
      addLog(game, `${actor.name} não tem ${CHARACTER_NAMES[pa.claimedCharacter]} — ${actor.name} perde influência! Ação cancelada.`);
      pa.loseInfluenceQueue.push({ playerId: pa.actorId });
      pa._afterLose = 'cancel_action';
      game.phase = 'LOSE_INFLUENCE';
    }
    return { success: true };
  }

  // ── Challenge the blocker's claimed character ────────────────────────────
  if (game.phase === 'BLOCK_CHALLENGE_WINDOW') {
    if (challengerId !== pa.actorId) return { success: false, error: 'Apenas quem foi bloqueado pode desafiar o bloqueio' };

    const { playerId: blockerId, character: blockerChar } = pa.blocker;
    const blocker = getPlayer(game, blockerId);
    const cardIdx = blocker.cards.findIndex(c => !c.dead && c.character === blockerChar);
    const blockerHasCard = cardIdx !== -1;

    addLog(game, `⚔️ ${challenger.name} DUVIDA do bloqueio de ${blocker.name}!`);

    if (blockerHasCard) {
      addLog(game, `${blocker.name} revela ${CHARACTER_NAMES[blockerChar]} — ${challenger.name} perde influência! Bloqueio mantido.`);
      const char = blocker.cards[cardIdx].character;
      game.deck.push(char);
      shuffle(game.deck);
      blocker.cards[cardIdx].character = game.deck.pop();
      pa.loseInfluenceQueue.push({ playerId: challengerId });
      pa._afterLose = 'block_stands';
      game.phase = 'LOSE_INFLUENCE';
    } else {
      addLog(game, `${blocker.name} não tem ${CHARACTER_NAMES[blockerChar]} — ${blocker.name} perde influência! Ação continua.`);
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
  if (!queue.length || queue[0].playerId !== playerId) return { success: false, error: 'Não é você que deve perder influência agora' };

  const player = getPlayer(game, playerId);
  const card = player.cards[cardIndex];
  if (!card || card.dead) return { success: false, error: 'Carta inválida' };

  card.dead = true;
  addLog(game, `${player.name} perde ${CHARACTER_NAMES[card.character]}`);
  queue.shift();

  if (checkGameOver(game)) return { success: true };

  if (queue.length > 0) return { success: true }; // more to lose

  // Decide what happens next based on _afterLose flag
  const flag = pa._afterLose;
  delete pa._afterLose;

  if (flag === 'continue_action') {
    resolveActionEffect(game);
  } else if (flag === 'cancel_action') {
    advanceTurn(game);
  } else if (flag === 'block_stands') {
    advanceTurn(game);
  } else if (flag === 'action_proceeds') {
    resolveActionEffect(game);
  } else {
    // Direct lose influence (golpe, assassinar target)
    advanceTurn(game);
  }

  return { success: true };
}

function handleInvestigateDecision(room, actorId, forceSwap) {
  const game = room.game;
  const pa = game.pendingAction;
  if (game.phase !== 'INVESTIGATE_DECISION' || pa.actorId !== actorId) return { success: false };

  const { cardIndex, targetId } = pa.investigationPeek;
  const target = getPlayer(game, targetId);
  const actor = getPlayer(game, actorId);

  if (forceSwap) {
    const oldChar = target.cards[cardIndex].character;
    game.deck.push(oldChar);
    shuffle(game.deck);
    target.cards[cardIndex].character = game.deck.pop();
    addLog(game, `${actor.name} forçou ${target.name} a trocar uma carta`);
  } else {
    addLog(game, `${actor.name} decidiu não trocar a carta de ${target.name}`);
  }

  advanceTurn(game);
  return { success: true };
}

module.exports = {
  handleAction,
  handlePass,
  handleBlock,
  handleChallenge,
  handleLoseInfluence,
  handleInvestigateDecision,
};
