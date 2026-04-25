const { shuffle } = require('./deck');
const { ACTION_DEFS, ACTION_NAMES, CHARACTER_NAMES, getBlockers } = require('./actions');

// ── Funny logs ────────────────────────────────────────────────────────────────
const FUNNY = {
  renda:        (a)    => `${a} trampou suado e ganhou 1 real 😤`,
  ajuda_externa:(a)    => `${a} declarou que imposto é roubo e pegou mais 2 moedas 💸`,
  golpe:        (a, t) => `${a} deu o Golpe em ${t}! O Brasil não é pra amadores 🪖`,
  taxar:        (a)    => `${a} fez o L na galera e taxou 3 moedas do banco 🤙`,
  roubar:       (a, t) => `${a} tá querendo demais e tentou Pegar o Arrego de ${t}! 🤑`,
  assassinar:   (a, t) => `${a} mandou ${t} pro Vasco! F no chat ⚰️`,
  veredito:     (a, t, ch) => `${a} bateu o martelo: ${t} é culpado de ter ${ch}! ⚖️`,
  veredito_fail:(a, t, ch) => `${a} errou o Veredito! ${t} não tinha ${ch}. Inocente! ⚖️`,
  meter_x9:     (a, t) => `${a} meteu o X9 em ${t}! Cê tá sendo investigado 👀`,
  disfarce:     (a)    => `${a} botou o disfarce! Mas será que alguém acredita? 🎭`,
  trocar_carta: (a, t) => `${a} infiltrou em ${t}! Troca de carta na marra 🕵️`,
  challenge_success: (c, a) => `${c} DUVIDOU e acertou! ${a} tava blefando igual político em campanha 🤥`,
  challenge_fail:    (c, a) => `${c} DUVIDOU e se deu mal! ${a} tinha a carta mesmo. Passou vergonha 😳`,
  block:             (b, act) => `${b} bloqueou a jogada! Ninguém passa fácil aqui 🛡️`,
  block_coin_flip:   (b) => `${b} pagou 1 moeda pra tentar bloquear! Hora do cara ou coroa... 🪙`,
  block_accepted:    (a)    => `${a} aceitou o bloqueio. Covardia? Estratégia? 🤷`,
  block_challenge_success: (c, b) => `${c} descobriu o blefe de ${b}! Tá tudo gravado, brother 📹`,
  block_challenge_fail:    (c, b) => `${c} duvidou do bloqueio e se arrependeu. ${b} tinha mesmo 😎`,
  coin_flip_cara:    (b, a) => `CARA! 🪙 Bloqueio aprovado! ${b} recupera a moeda. ${a} não rouba nada!`,
  coin_flip_coroa:   (b, a, s) => `COROA! 🪙 Bloqueio cancelado! ${a} fica com a moeda e ainda rouba ${s} moedas!`,
  lose_influence: (p, ch)  => `${p} perdeu ${ch}. F no chat ⚰️`,
  eliminated:     (p)      => `${p} tá eliminado! Foi pro Vasco definitivamente 👋`,
  turn_start:     (p)      => `🔥 Vez de ${p}. Bora ver o que essa pessoa vai aprontar...`,
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

// ── Random Events ─────────────────────────────────────────────────────────────

const EVENT_DEFS = [
  { type: 'no_event',        name: 'Sem Evento',       emoji: '😴', description: 'Nenhum evento nesta rodada.',                        weight: 5 },
  { type: 'operacao_pf',     name: 'Operação da PF',   emoji: '🚔', description: 'Ninguém pode roubar neste round.',                   weight: 1 },
  { type: 'fake_news',       name: 'Fake News',         emoji: '📰', description: 'X9 e Infiltrar bloqueados neste round. Disfarce permitido.', weight: 1 },
  { type: 'jogo_do_bicho',   name: 'Jogo do Bicho',    emoji: '🎲', description: 'Todos participam! Resultado aleatório pra cada um.', weight: 1 },
  { type: 'mensalao',        name: 'Mensalão',          emoji: '💵', description: 'Todos ganham 1 moeda do governo.',                   weight: 1 },
  { type: 'arrastaoo',       name: 'Arrastão',          emoji: '💸', description: 'Jogador com mais moedas perde 2.',                   weight: 1 },
  { type: 'crise_economica', name: 'Crise Econômica',   emoji: '📉', description: 'Ações que geram moedas dão 1 a menos neste round.',  weight: 1 },
];

const BICHO_OUTCOMES = [
  { key: 'ganha1', label: '+1 moeda',   coinDelta: +1 },
  { key: 'ganha2', label: '+2 moedas',  coinDelta: +2 },
  { key: 'perde1', label: '-1 moeda',   coinDelta: -1 },
  { key: 'perde2', label: '-2 moedas',  coinDelta: -2 },
  { key: 'nada',   label: 'Sem efeito', coinDelta:  0 },
  { key: 'skip',   label: 'Pula a vez', coinDelta:  0 },
];

const NO_EVENT_JOKES = [
  '😴 Governo em greve! Nenhum evento nessa rodada. Aproveita.',
  '🍺 Sistema saiu pra tomar uma cerveja. Sem eventos!',
  '📺 Intervalo comercial! Nenhum evento nessa rodada.',
  '🤷 Jogou os dados, não deu nada. Vai de boa.',
  '🎭 O destino cochilou. Essa rodada vai ser Normal™.',
  '🛌 Mensalão atrasou e a PF tá de folga... Sem eventos.',
  '☕ Até o jogo do bicho tirou férias. Calma nessa rodada.',
  '🏖️ Brasília em recesso. Politicagem suspensa por essa rodada.',
];

let _eventCounter = 0;
function rollRandomEvent() {
  const totalWeight = EVENT_DEFS.reduce((s, e) => s + (e.weight || 1), 0);
  let r = Math.random() * totalWeight;
  for (const def of EVENT_DEFS) {
    r -= (def.weight || 1);
    if (r <= 0) return { ...def, eventId: ++_eventCounter };
  }
  return { ...EVENT_DEFS[EVENT_DEFS.length - 1], eventId: ++_eventCounter };
}

/**
 * Rola o evento do novo round, aplica efeitos imediatos (mensalão, arrastão, bicho)
 * e define game.activeEvent (null para no_event).
 * Chamado no início de cada round e ao iniciar a partida.
 */
function rollAndApplyRoundEvent(game) {
  game.activeEvent = null;
  if (!game.eventsEnabled) return; // Modo TikTok desabilitado — sem eventos
  const event = rollRandomEvent();
  if (event.type === 'no_event') {
    const joke = NO_EVENT_JOKES[Math.floor(Math.random() * NO_EVENT_JOKES.length)];
    log(game, joke);
    // activeEvent permanece null — o cliente não exibe popup, só vê a mensagem no chat
  } else {
    game.activeEvent = event;
    applyEventEffect(game, event);
  }
}

function applyEventEffect(game, event) {
  const alive = getAlivePlayers(game);
  switch (event.type) {
    case 'mensalao':
      alive.forEach(p => { p.coins += 1; });
      log(game, `💵 MENSALÃO! Governo distribuiu 1 moeda pra todo mundo.`);
      break;

    case 'arrastaoo': {
      const maxCoins = Math.max(...alive.map(p => p.coins));
      const richest = alive.filter(p => p.coins === maxCoins);
      richest.forEach(p => { p.coins = Math.max(0, p.coins - 2); });
      log(game, `💸 ARRASTÃO! ${richest.map(p => p.name).join(' e ')} perdeu${richest.length > 1 ? 'm' : ''} 2 moedas!`);
      break;
    }

    case 'jogo_do_bicho': {
      const results = alive.map(p => {
        const outcome = BICHO_OUTCOMES[Math.floor(Math.random() * BICHO_OUTCOMES.length)];
        if (outcome.coinDelta !== 0) p.coins = Math.max(0, p.coins + outcome.coinDelta);
        if (outcome.key === 'skip') {
          if (!game.skipNextTurn) game.skipNextTurn = [];
          game.skipNextTurn.push(p.id);
        }
        return { playerId: p.id, playerName: p.name, key: outcome.key, label: outcome.label, coinDelta: outcome.coinDelta };
      });
      event.results = results;
      log(game, `🎲 JOGO DO BICHO! Todo mundo apostou no bicho.`);
      break;
    }

    case 'operacao_pf':
      log(game, `🚔 OPERAÇÃO DA PF! Roubo bloqueado neste round.`);
      break;

    case 'fake_news':
      log(game, `📰 FAKE NEWS! Investigações suspensas neste round.`);
      break;

    case 'crise_economica':
      log(game, `📉 CRISE ECONÔMICA! Ações rendem 1 moeda a menos neste round.`);
      break;

    case 'no_event':
      log(game, `😴 Nenhum evento nesta rodada. Descansa... por enquanto.`);
      break;
  }
}

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

  // Garante que os campos de round existem (retrocompatibilidade)
  if (!game.roundActedPlayers) game.roundActedPlayers = [];
  if (!game.roundNumber)       game.roundNumber       = 1;

  // Registra que o jogador atual completou sua vez neste round
  if (!game.roundActedPlayers.includes(game.currentPlayerId)) {
    game.roundActedPlayers.push(game.currentPlayerId);
  }

  const alive = getAlivePlayers(game);
  const idx   = alive.findIndex(p => p.id === game.currentPlayerId);
  const nextIdx = (Math.max(idx, 0) + 1) % alive.length;
  let next = alive[nextIdx];

  // Handle Jogo do Bicho "pula a vez"
  if (game.skipNextTurn?.includes(next.id) && alive.length > 1) {
    game.skipNextTurn = game.skipNextTurn.filter(id => id !== next.id);
    log(game, `🎲 ${next.name} pulou a vez! (Jogo do Bicho)`);
    next = alive[(nextIdx + 1) % alive.length];
  }

  // Detecta novo round: todos os jogadores vivos já agiram neste round
  const allActed = alive.every(p => game.roundActedPlayers.includes(p.id));
  if (allActed) {
    game.roundNumber++;
    game.roundActedPlayers = [];
    log(game, `━━━ 🔔 ROUND ${game.roundNumber} ━━━`);
    rollAndApplyRoundEvent(game);
  }

  game.currentPlayerId = next.id;
  game.phase           = 'ACTION_SELECT';
  game.pendingAction   = null;
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
  const crise = game.activeEvent?.type === 'crise_economica';

  switch (type) {
    case 'renda':
      actor.coins += 1; // Trampo Suado sempre dá 1 (crise não afeta renda)
      log(game, FUNNY.renda(actor.name));
      break;

    case 'ajuda_externa':
      actor.coins += crise ? 1 : 2;
      log(game, FUNNY.ajuda_externa(actor.name) + (crise ? ' (crise: -1 📉)' : ''));
      break;

    case 'taxar':
      actor.coins += crise ? 2 : 3;
      log(game, FUNNY.taxar(actor.name) + (crise ? ' (crise: -1 📉)' : ''));
      break;

    case 'roubar': {
      const target = getPlayer(game, targetId);
      const stolen = Math.min(2, target.coins);
      target.coins -= stolen;
      actor.coins += stolen;
      log(game, FUNNY.roubar(actor.name, target.name) + ` (${stolen} moeda${stolen !== 1 ? 's' : ''})`);
      break;
    }

    case 'veredito': {
      const target = getPlayer(game, targetId);
      const vereditoChar = pa.vereditoCharacter;
      const cardIdx = target.cards.findIndex(c => !c.dead && c.character === vereditoChar);
      if (cardIdx !== -1) {
        log(game, FUNNY.veredito(actor.name, target.name, CHARACTER_NAMES[vereditoChar]));
        target.cards[cardIdx].dead = true;
        log(game, FUNNY.lose_influence(target.name, CHARACTER_NAMES[vereditoChar]));
        if (!target.cards.some(c => !c.dead)) log(game, FUNNY.eliminated(target.name));
        if (checkGameOver(game)) return;
      } else {
        log(game, FUNNY.veredito_fail(actor.name, target.name, CHARACTER_NAMES[vereditoChar]));
      }
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
      // Draw up to 2 random options from deck for player to choose
      const opts = [];
      if (game.deck.length >= 1) opts.push(game.deck.pop());
      if (game.deck.length >= 1) opts.push(game.deck.pop());
      pa.disfarceOptions = opts;
      game.phase = 'DISFARCE_SELECT';
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

function handleAction(room, actorId, actionType, targetId, extraData = {}) {
  const game = room.game;
  if (game.phase !== 'ACTION_SELECT') return { success: false, error: 'Fase incorreta' };
  if (game.currentPlayerId !== actorId) return { success: false, error: 'Não é sua vez' };

  const def = ACTION_DEFS[actionType];
  if (!def) return { success: false, error: 'Ação inválida' };

  // ── Event-based action blocking ──────────────────────────────────────────
  const evType = game.activeEvent?.type;
  if (evType === 'operacao_pf' && actionType === 'roubar')
    return { success: false, error: '🚔 Operação da PF: ninguém pode roubar neste round!' };
  if (evType === 'fake_news' && ['meter_x9', 'trocar_carta'].includes(actionType))
    return { success: false, error: '📰 Fake News: X9 e Infiltrar bloqueados neste round!' };

  const actor = getPlayer(game, actorId);
  if (def.cost && actor.coins < def.cost) return { success: false, error: 'Moedas insuficientes' };
  if (actor.coins >= 10 && actionType !== 'golpe') return { success: false, error: 'Com 10+ moedas é obrigatório usar Golpe de Estado' };
  if (def.requiresTarget && !targetId) return { success: false, error: 'Escolha um alvo primeiro' };
  if (actionType === 'veredito' && !extraData.accusedCharacter)
    return { success: false, error: 'Selecione qual carta você está acusando o alvo de ter' };
  if (targetId) {
    const t = getPlayer(game, targetId);
    if (!t || !t.cards.some(c => !c.dead)) return { success: false, error: 'Alvo inválido' };
  }

  if (def.cost) actor.coins -= def.cost;

  game.pendingAction = {
    type: actionType, actorId, targetId: targetId || null,
    claimedCharacter: def.character || null,
    blocker: null, respondedPlayers: [], loseInfluenceQueue: [],
    vereditoCharacter: extraData.accusedCharacter || null,
  };

  // Pré-adiciona não-alvo para ações direcionadas sem anyoneCanChallenge
  if (def.requiresTarget && targetId && !def.anyoneCanChallenge) {
    getAlivePlayers(game)
      .filter(p => p.id !== actorId && p.id !== targetId)
      .forEach(p => game.pendingAction.respondedPlayers.push(p.id));
  }

  const tName = targetId ? getPlayer(game, targetId)?.name : null;
  const vereditoInfo = actionType === 'veredito' && extraData.accusedCharacter
    ? ` (acusando de ter ${CHARACTER_NAMES[extraData.accusedCharacter]})`
    : '';
  log(game, `${actor.name} declara: ${ACTION_NAMES[actionType]}${tName ? ` → ${tName}` : ''}${vereditoInfo}`);

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
    if (pa.coinFlipPending) {
      // Ator aceita o bloqueio com coin flip — transiciona para aguardar o bloqueador jogar a moeda
      delete pa.coinFlipPending;
      game.phase = 'COIN_FLIP';
      log(game, `${getPlayer(game, pa.blocker.playerId).name} vai jogar a moeda! 🪙`);
    } else {
      log(game, FUNNY.block_accepted(getPlayer(game, pa.actorId).name));
      advanceTurn(game);
    }
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

  const blocker = getPlayer(game, blockerId);
  const actor   = getPlayer(game, pa.actorId);

  if (def.coinFlipBlock) {
    if (blocker.coins < 1) return { success: false, error: 'Você precisa de 1 moeda para tentar bloquear' };
    blocker.coins -= 1;
    actor.coins += 1;
    pa.coinFlipPending = true;
    pa.blocker = { playerId: blockerId, character: claimedCharacter };
    game.phase = 'BLOCK_CHALLENGE_WINDOW';
    log(game, FUNNY.block_coin_flip(blocker.name));
    return { success: true };
  }

  pa.blocker = { playerId: blockerId, character: claimedCharacter };
  game.phase = 'BLOCK_CHALLENGE_WINDOW';
  log(game, FUNNY.block(blocker.name, ACTION_NAMES[pa.type]));
  return { success: true };
}

function handleChallenge(room, challengerId) {
  const game = room.game;
  const pa = game.pendingAction;
  if (!pa) return { success: false };

  const challenger = getPlayer(game, challengerId);

  if (game.phase === 'RESPONSE_WINDOW') {
    if (!pa.claimedCharacter) return { success: false, error: 'Ação não pode ser desafiada' };
    if (challengerId === pa.actorId) return { success: false, error: 'Não pode se desafiar' };

    const def = ACTION_DEFS[pa.type];
    if (def.requiresTarget && pa.targetId && !def.anyoneCanChallenge && challengerId !== pa.targetId)
      return { success: false, error: 'Só o alvo pode duvidar desta ação' };

    const actor = getPlayer(game, pa.actorId);
    const cardIdx = actor.cards.findIndex(c => !c.dead && c.character === pa.claimedCharacter);

    if (cardIdx !== -1) {
      log(game, FUNNY.challenge_fail(challenger.name, actor.name));
      pa.challengeWonCharacter = actor.cards[cardIdx].character;
      pa.challengeWonCardIdx = cardIdx;
      pa._afterLose = 'continue_action';
      pa.loseInfluenceQueue.push({ playerId: challengerId });
      game.phase = 'CHALLENGE_WON'; // actor will choose swap/keep
    } else {
      log(game, FUNNY.challenge_success(challenger.name, actor.name));
      pa.loseInfluenceQueue.push({ playerId: pa.actorId });
      pa._afterLose = 'cancel_action';
      game.phase = 'LOSE_INFLUENCE';
    }
    return { success: true };
  }

  if (game.phase === 'BLOCK_CHALLENGE_WINDOW') {
    if (challengerId !== pa.actorId) return { success: false, error: 'Só quem foi bloqueado pode desafiar o bloqueio' };

    const { playerId: blockerId, character: blockerChar } = pa.blocker;
    const blocker = getPlayer(game, blockerId);
    const cardIdx = blocker.cards.findIndex(c => !c.dead && c.character === blockerChar);

    if (cardIdx !== -1) {
      log(game, FUNNY.block_challenge_fail(challenger.name, blocker.name));
      const char = blocker.cards[cardIdx].character;
      game.deck.push(char); shuffle(game.deck);
      blocker.cards[cardIdx].character = game.deck.pop();
      pa.loseInfluenceQueue.push({ playerId: challengerId });
      // Se tinha coinFlip pendente, após perder carta vai pra coin flip
      pa._afterLose = pa.coinFlipPending ? 'coin_flip_after_lose' : 'block_stands';
      game.phase = 'LOSE_INFLUENCE';
    } else {
      log(game, FUNNY.block_challenge_success(challenger.name, blocker.name));
      pa.loseInfluenceQueue.push({ playerId: blockerId });
      delete pa.coinFlipPending;
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
  if (!player.cards.some(c => !c.dead)) log(game, FUNNY.eliminated(player.name));

  queue.shift();

  if (checkGameOver(game)) return { success: true };
  if (queue.length > 0) return { success: true };

  const flag = pa._afterLose;
  delete pa._afterLose;

  if (flag === 'continue_action')        resolveActionEffect(game);
  else if (flag === 'cancel_action')     advanceTurn(game);
  else if (flag === 'block_stands')      advanceTurn(game);
  else if (flag === 'action_proceeds')   resolveActionEffect(game);
  else if (flag === 'coin_flip_after_lose') {
    // Bloqueio validado (ator perdeu o desafio) → bloqueador agora joga a moeda
    delete pa.coinFlipPending;
    game.phase = 'COIN_FLIP';
    log(game, `${getPlayer(game, pa.blocker.playerId).name} vai jogar a moeda! 🪙`);
  }
  else advanceTurn(game);

  return { success: true };
}

function handleChallengeWonChoice(room, actorId, wantsSwap) {
  const game = room.game;
  const pa = game.pendingAction;
  if (game.phase !== 'CHALLENGE_WON') return { success: false, error: 'Fase incorreta' };
  if (!pa || pa.actorId !== actorId) return { success: false, error: 'Só o ator pode decidir' };

  const actor = getPlayer(game, actorId);
  if (wantsSwap) {
    const idx = pa.challengeWonCardIdx;
    if (idx !== undefined) {
      const card = actor.cards[idx];
      if (card && !card.dead) {
        game.deck.push(card.character);
        shuffle(game.deck);
        card.character = game.deck.pop();
        log(game, `${actor.name} provou a carta e trocou pelo baralho. 🔄`);
      }
    }
  } else {
    log(game, `${actor.name} provou a carta e decidiu mantê-la. ✊`);
  }
  delete pa.challengeWonCardIdx;
  delete pa.challengeWonCharacter;
  game.phase = 'LOSE_INFLUENCE';
  return { success: true };
}

// ── Coin flip: bloqueador joga a moeda ──────────────────────────────────────

function handleFlipCoin(room, flipperId) {
  const game = room.game;
  const pa = game.pendingAction;
  if (game.phase !== 'COIN_FLIP') return { success: false, error: 'Fase incorreta' };
  if (!pa || pa.blocker.playerId !== flipperId) return { success: false, error: 'Só o bloqueador pode jogar a moeda' };
  if (pa.coinFlipResult) return { success: false, error: 'Moeda já foi jogada' };

  const result = Math.random() < 0.5 ? 'cara' : 'coroa';
  pa.coinFlipResult = result;
  log(game, `A moeda foi jogada! Resultado: ${result === 'cara' ? '🦅 CARA' : '🐉 COROA'}`);
  return { success: true };
}

// ── Resolução do coin flip (ator confirma após animação) ─────────────────────

function handleAcknowledgeCoinFlip(room, actorId) {
  const game = room.game;
  const pa = game.pendingAction;
  if (game.phase !== 'COIN_FLIP') return { success: false, error: 'Fase incorreta' };
  if (!pa || !pa.coinFlipResult) return { success: false, error: 'Resultado da moeda ainda não definido' };
  if (pa.actorId !== actorId) return { success: false, error: 'Só o Bicheiro pode confirmar' };

  const result  = pa.coinFlipResult;
  const actor   = getPlayer(game, pa.actorId);
  const blocker = getPlayer(game, pa.blocker.playerId);
  const target  = getPlayer(game, pa.targetId);

  if (result === 'cara') {
    actor.coins  -= 1;
    blocker.coins += 1;
    log(game, FUNNY.coin_flip_cara(blocker.name, actor.name));
    advanceTurn(game);
  } else {
    const stolen = Math.min(2, target.coins);
    target.coins -= stolen;
    actor.coins  += stolen;
    log(game, FUNNY.coin_flip_coroa(blocker.name, actor.name, stolen));
    advanceTurn(game);
  }
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

function handleSelectDisfarce(room, playerId, { myCardIndex, pickedOption }) {
  const game = room.game;
  const pa = game.pendingAction;
  if (game.phase !== 'DISFARCE_SELECT') return { success: false, error: 'Fase incorreta' };
  if (pa.swapPlayerId !== playerId) return { success: false, error: 'Não é você que deve escolher' };

  const player = getPlayer(game, playerId);
  const card = player.cards[myCardIndex];
  if (!card || card.dead) return { success: false, error: 'Carta inválida' };

  const opts = pa.disfarceOptions || [];

  if (pickedOption !== null && pickedOption !== undefined && opts[pickedOption] !== undefined) {
    const chosen = opts[pickedOption];
    const old = card.character;
    card.character = chosen;
    // Return old card + unchosen options to deck
    const unchosen = opts.filter((_, i) => i !== Number(pickedOption));
    game.deck.push(old, ...unchosen);
    shuffle(game.deck);
    log(game, `${player.name} botou o disfarce e trocou uma carta! 🎭`);
  } else {
    // Keep current cards, return all options to deck
    game.deck.push(...opts);
    shuffle(game.deck);
    log(game, `${player.name} não quis trocar no disfarce. 🎭`);
  }

  delete pa.disfarceOptions;
  advanceTurn(game);
  return { success: true };
}

module.exports = {
  handleAction, handlePass, handleBlock, handleChallenge,
  handleLoseInfluence, handleChallengeWonChoice, handleFlipCoin, handleAcknowledgeCoinFlip,
  handleSelectCardShow, handleAcknowledgePeek, handleSelectCardSwap, handleSelectDisfarce,
  // Exposed for timer auto-actions
  getAlivePlayers, getPlayer, resolveActionEffect,
  // Exposed for rooms.js (inicializa o evento do round 1)
  rollAndApplyRoundEvent,
};
