const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const {
  rooms,
  createRoom, createPveRoom, joinRoom, startGame: startGameInRoom,
  removePlayerFromRoom, getRoomByPlayer, getRoomByCode, generateRoomForClient,
} = require('./rooms');
const {
  BOT_DIFFICULTY_LEVELS,
  getTurnDelay,
  getReactDelay,
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
} = require('./game/bot');
const {
  handleAction, handlePass, handleBlock, handleChallenge,
  handleLoseInfluence, handleChallengeWonChoice, handleFlipCoin, handleAcknowledgeCoinFlip,
  handleSelectCardShow, handleAcknowledgePeek, handleSelectCardSwap, handleSelectDisfarce,
  getAlivePlayers, getPlayer, resolveActionEffect,
} = require('./game/engine');

const app = express();
app.use(cors());
app.use(express.json());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

app.get('/health', (_, res) => res.json({ ok: true }));

// ── Action cooldown — protects against double-tap / replay on mobile ─────────
/** playerId → timestamp of last accepted take_action */
const actionCooldowns = new Map();
const ACTION_COOLDOWN_MS = 600;

// ── Turn timer (60 s) ─────────────────────────────────────────────────────────

const turnTimers = new Map(); // roomCode → setTimeout handle
const TURN_TIMEOUT_MS = 60_000;
const NO_TIMER_PHASES = ['X9_PEEK_SELECT', 'X9_PEEK_VIEW', 'CARD_SWAP_SELECT', 'DISFARCE_SELECT'];

function clearTurnTimer(roomCode) {
  if (turnTimers.has(roomCode)) {
    clearTimeout(turnTimers.get(roomCode));
    turnTimers.delete(roomCode);
  }
}

function setTurnTimer(room) {
  clearTurnTimer(room.code);
  const game = room.game;
  if (!game || game.phase === 'GAME_OVER') return;

  // Phases that don't need a timeout (player interaction expected but no rush)
  if (NO_TIMER_PHASES.includes(game.phase)) {
    room._timerStartedAt = null; // garante que clientes não mostram timer nessas fases
    return;
  }

  // In PVE rooms, skip the turn timer when it's a bot's ACTION_SELECT turn —
  // the bot scheduler handles it. The timer still runs for the human player.
  if (room.isPve && game.phase === 'ACTION_SELECT' && isBotPlayer(room, game.currentPlayerId)) {
    room._timerStartedAt = null;
    return;
  }

  room._timerStartedAt = Date.now();

  const timer = setTimeout(() => {
    turnTimers.delete(room.code);
    if (!room.game) return;
    const g = room.game;
    const pa = g.pendingAction;

    try {
      switch (g.phase) {
        case 'ACTION_SELECT':
          // Auto: Trampo Suado
          handleAction(room, g.currentPlayerId, 'renda', null, {});
          break;

        case 'RESPONSE_WINDOW': {
          if (!pa) break;
          // Auto-pass para todos que não responderam
          getAlivePlayers(g).filter(p => p.id !== pa.actorId).forEach(p => {
            if (!pa.respondedPlayers.includes(p.id)) pa.respondedPlayers.push(p.id);
          });
          const all = getAlivePlayers(g).filter(p => p.id !== pa.actorId);
          if (all.every(p => pa.respondedPlayers.includes(p.id))) resolveActionEffect(g);
          break;
        }

        case 'BLOCK_CHALLENGE_WINDOW':
          // Ator aceita o bloqueio automaticamente
          if (pa) handlePass(room, pa.actorId);
          break;

        case 'LOSE_INFLUENCE': {
          if (!pa || !pa.loseInfluenceQueue.length) break;
          const loserId = pa.loseInfluenceQueue[0].playerId;
          const loser = getPlayer(g, loserId);
          if (!loser) break;
          const alive = loser.cards.map((c, i) => ({ ...c, idx: i })).filter(c => !c.dead);
          if (alive.length > 0) {
            const pick = alive[Math.floor(Math.random() * alive.length)];
            handleLoseInfluence(room, loserId, pick.idx);
          }
          break;
        }

        case 'COIN_FLIP': {
          if (!pa) break;
          if (!pa.coinFlipResult) {
            // Auto-flip se bloqueador não jogou
            handleFlipCoin(room, pa.blocker.playerId);
          } else {
            // Auto-resolve se ator não confirmou
            handleAcknowledgeCoinFlip(room, pa.actorId);
          }
          break;
        }

        case 'CHALLENGE_WON':
          if (pa) handleChallengeWonChoice(room, pa.actorId, true); // auto-swap on timeout
          break;
      }
    } catch (e) {
      console.error('[timer] auto-action error:', e);
    }

    broadcast(room);
    if (room.game && room.game.phase !== 'GAME_OVER') setTurnTimer(room);
  }, TURN_TIMEOUT_MS);

  turnTimers.set(room.code, timer);
}

// ── Bot turn scheduler ────────────────────────────────────────────────────────

const botTimers = new Map(); // roomCode → setTimeout handle

function clearBotTimer(roomCode) {
  if (botTimers.has(roomCode)) {
    clearTimeout(botTimers.get(roomCode));
    botTimers.delete(roomCode);
  }
}

function isBotPlayer(room, playerId) {
  if (!playerId) return false;
  return !!room.players.find(p => p.id === playerId && p.isBot);
}

/**
 * After every broadcast() in a PVE room, figure out if a bot needs to act
 * and schedule it with a think-time delay.
 */
function scheduleBotTurn(room) {
  if (!room.isPve) return;
  if (!room.game || room.game.phase === 'GAME_OVER') return;

  clearBotTimer(room.code);

  const game = room.game;
  const pa   = game.pendingAction;
  let botId  = null;

  switch (game.phase) {
    case 'ACTION_SELECT':
      if (isBotPlayer(room, game.currentPlayerId)) botId = game.currentPlayerId;
      break;

    case 'RESPONSE_WINDOW':
      if (pa) {
        const bot = getAlivePlayers(game).find(p =>
          isBotPlayer(room, p.id) &&
          p.id !== pa.actorId &&
          !pa.respondedPlayers?.includes(p.id),
        );
        if (bot) botId = bot.id;
      }
      break;

    case 'BLOCK_CHALLENGE_WINDOW':
      if (pa && isBotPlayer(room, pa.actorId)) botId = pa.actorId;
      break;

    case 'LOSE_INFLUENCE':
      if (pa?.loseInfluenceQueue?.length) {
        const lid = pa.loseInfluenceQueue[0].playerId;
        if (isBotPlayer(room, lid)) botId = lid;
      }
      break;

    case 'COIN_FLIP':
      if (pa?.blocker) {
        if (!pa.coinFlipResult && isBotPlayer(room, pa.blocker.playerId)) {
          botId = pa.blocker.playerId;
        } else if (pa.coinFlipResult && isBotPlayer(room, pa.actorId)) {
          botId = pa.actorId;
        }
      }
      break;

    case 'CHALLENGE_WON':
      if (pa && isBotPlayer(room, pa.actorId)) botId = pa.actorId;
      break;

    case 'X9_PEEK_SELECT':
      if (pa && isBotPlayer(room, pa.targetId)) botId = pa.targetId;
      break;

    case 'X9_PEEK_VIEW':
      if (pa && isBotPlayer(room, pa.actorId)) botId = pa.actorId;
      break;

    case 'CARD_SWAP_SELECT':
      if (pa?.swapPlayerId && isBotPlayer(room, pa.swapPlayerId)) botId = pa.swapPlayerId;
      break;

    case 'DISFARCE_SELECT':
      if (pa && isBotPlayer(room, pa.actorId)) botId = pa.actorId;
      break;

    default:
      break;
  }

  if (!botId) return;

  const level = BOT_DIFFICULTY_LEVELS[room.pveDifficulty] ?? 1;
  const delay = game.phase === 'ACTION_SELECT' ? getTurnDelay(level) : getReactDelay(level);

  const timer = setTimeout(() => {
    botTimers.delete(room.code);
    if (!room.game || room.game.phase === 'GAME_OVER') return;

    try {
      executeBotAction(room, botId, level);
    } catch (e) {
      console.error('[bot] error executing turn:', e);
    }

    // broadcast already calls scheduleBotTurn internally
    broadcast(room);
  }, delay);

  botTimers.set(room.code, timer);
}

function executeBotAction(room, botId, level) {
  const game = room.game;
  const pa   = game.pendingAction;

  switch (game.phase) {
    case 'ACTION_SELECT': {
      const { action, targetId } = chooseBotAction(game, botId, level);
      handleAction(room, botId, action, targetId, {});
      break;
    }

    case 'RESPONSE_WINDOW': {
      if (!pa) { handlePass(room, botId); break; }
      if (decideBotChallenge(game, botId, level)) {
        handleChallenge(room, botId);
        break;
      }
      const blockChar = decideBotBlock(game, botId, level);
      if (blockChar) {
        handleBlock(room, botId, blockChar);
        break;
      }
      handlePass(room, botId);
      break;
    }

    case 'BLOCK_CHALLENGE_WINDOW': {
      if (!pa || pa.actorId !== botId) break;
      if (decideBotChallengeBlock(game, botId, level)) {
        handleChallenge(room, botId);
        break;
      }
      handlePass(room, botId); // accept the block
      break;
    }

    case 'LOSE_INFLUENCE': {
      if (!pa?.loseInfluenceQueue?.length) break;
      if (pa.loseInfluenceQueue[0].playerId !== botId) break;
      const cardIdx = chooseLoseInfluence(game, botId, level);
      handleLoseInfluence(room, botId, cardIdx);
      break;
    }

    case 'COIN_FLIP': {
      if (!pa) break;
      if (!pa.coinFlipResult && pa.blocker?.playerId === botId) {
        handleFlipCoin(room, botId);
      } else if (pa.coinFlipResult && pa.actorId === botId) {
        handleAcknowledgeCoinFlip(room, botId);
      }
      break;
    }

    case 'CHALLENGE_WON': {
      if (!pa || pa.actorId !== botId) break;
      const wantsSwap = decideChallengeWonSwap(game, botId, level);
      handleChallengeWonChoice(room, botId, wantsSwap);
      break;
    }

    case 'X9_PEEK_SELECT': {
      if (!pa || pa.targetId !== botId) break;
      const cardIdx = chooseBotCardShow(game, botId, level);
      handleSelectCardShow(room, botId, cardIdx);
      break;
    }

    case 'X9_PEEK_VIEW': {
      if (!pa || pa.actorId !== botId) break;
      // Record what the bot just saw for future turns
      if (pa.x9Result && pa.targetId) {
        recordBotX9Memory(room.game, botId, pa.targetId, pa.x9Result.character);
      }
      handleAcknowledgePeek(room, botId);
      break;
    }

    case 'CARD_SWAP_SELECT': {
      if (!pa || pa.swapPlayerId !== botId) break;
      const cardIdx = chooseBotCardSwap(game, botId, level);
      handleSelectCardSwap(room, botId, cardIdx);
      break;
    }

    case 'DISFARCE_SELECT': {
      if (!pa || pa.actorId !== botId) break;
      const opts = pa.disfarceOptions || [];
      const { myCardIndex, pickedOption } = chooseBotDisfarce(game, botId, opts, level);
      handleSelectDisfarce(room, botId, { myCardIndex, pickedOption });
      break;
    }

    default:
      break;
  }
}

// ── Reconnection state ────────────────────────────────────────────────────────

/** pid → { roomCode, playerId (original socket id) } */
const pidSessions = new Map();

/** pid → setTimeout handle (30 s grace period before removing player) */
const disconnectTimers = new Map();

const GRACE_PERIOD_MS = 20_000; // 20s — dentro do janela de 35s do cliente

// ── Sanitize ─────────────────────────────────────────────────────────────────

function sanitizeGame(game, playerId) {
  return {
    players: game.players.map(p => ({
      id: p.id, name: p.name, coins: p.coins,
      alive: p.cards.some(c => !c.dead),
      isBot: p.isBot || false,
      cards: p.cards.map((c, i) => ({
        index: i, dead: c.dead,
        character: (p.id === playerId || c.dead) ? c.character : null,
      })),
    })),
    currentPlayerId: game.currentPlayerId,
    phase: game.phase,
    pendingAction: sanitizePA(game.pendingAction, playerId),
    log: game.log.slice(-25),
    winner: game.winner,
    activeEvent: game.activeEvent
      ? { ...game.activeEvent, bigFoneClaimed: game.activeEvent.bigFoneClaimed ?? false }
      : null,
    roundNumber: game.roundNumber || 1,
    eventsEnabled: game.eventsEnabled ?? false,
  };
}

/** Spectators are omniscient — they see ALL cards (live and dead) */
function sanitizeGameForSpectator(game) {
  return {
    players: game.players.map(p => ({
      id: p.id, name: p.name, coins: p.coins,
      alive: p.cards.some(c => !c.dead),
      // Spectators see every card including face-down ones
      cards: p.cards.map((c, i) => ({ index: i, dead: c.dead, character: c.character })),
    })),
    currentPlayerId: game.currentPlayerId,
    phase: game.phase,
    pendingAction: game.pendingAction ? {
      type: game.pendingAction.type,
      actorId: game.pendingAction.actorId,
      targetId: game.pendingAction.targetId,
      claimedCharacter: game.pendingAction.claimedCharacter,
      blocker: game.pendingAction.blocker,
      respondedPlayers: game.pendingAction.respondedPlayers,
      loseInfluenceQueue: game.pendingAction.loseInfluenceQueue,
      vereditoCharacter: game.pendingAction.vereditoCharacter || null,
      challengeWonCharacter: game.pendingAction.challengeWonCharacter || null,
    } : null,
    log: game.log.slice(-30),
    winner: game.winner,
    activeEvent: game.activeEvent ?? null,
    roundNumber: game.roundNumber || 1,
  };
}

function sanitizePA(pa, playerId) {
  if (!pa) return null;
  const base = {
    type: pa.type, actorId: pa.actorId, targetId: pa.targetId,
    claimedCharacter: pa.claimedCharacter, blocker: pa.blocker,
    respondedPlayers: pa.respondedPlayers, loseInfluenceQueue: pa.loseInfluenceQueue,
    swapPlayerId: pa.swapPlayerId, swapContext: pa.swapContext,
    vereditoCharacter: pa.vereditoCharacter || null,
    coinFlipResult: pa.coinFlipResult || null,
    coinFlipPending: pa.coinFlipPending || false,
    challengeWonCharacter: pa.challengeWonCharacter || null,
  };
  if (pa.x9Result && pa.actorId === playerId) base.x9Result = pa.x9Result;
  if (pa.disfarceOptions && pa.actorId === playerId) base.disfarceOptions = pa.disfarceOptions;
  return base;
}

/**
 * Broadcast the current game state to all players in the room.
 * Uses player.currentSocketId so reconnected players receive messages on their new socket.
 * Optional extra fields (e.g. { reconnected, playerId }) are merged into the payload for one player.
 */
function broadcast(room, extraForPlayer = null) {
  if (!room.game) return;

  // Reset timer when phase OR current player changes
  const currentPhase    = room.game.phase;
  const currentPlayerNow = room.game.currentPlayerId;
  if (currentPhase !== room._lastPhase || currentPlayerNow !== room._lastCurrentPlayer) {
    room._lastPhase         = currentPhase;
    room._lastCurrentPlayer = currentPlayerNow;
    setTurnTimer(room);
  }

  // Calcula tempo restante server-side para evitar dessincronização por clock skew entre cliente/servidor
  const _now = Date.now();
  const _hasTimer = room._timerStartedAt && !NO_TIMER_PHASES.includes(room.game.phase) && room.game.phase !== 'GAME_OVER';
  const _timeRemaining = _hasTimer
    ? Math.max(0, Math.ceil((room._timerStartedAt + TURN_TIMEOUT_MS - _now) / 1000))
    : null;

  room.players.forEach(p => {
    if (p.isBot) return; // bots don't have real sockets
    const sid = p.currentSocketId || p.id;
    const payload = {
      code: room.code, hostId: room.hostId, status: 'playing',
      game: sanitizeGame(room.game, p.id),
      timerStartedAt: room._timerStartedAt || null,
      timeRemaining: _timeRemaining,
      musicTrack: room.musicTrack || 'none',
      musicLastChanged: room.musicLastChanged || 0,
      isPve: room.isPve || false,
      pveDifficulty: room.pveDifficulty || null,
    };
    if (extraForPlayer && extraForPlayer.playerId === p.id) {
      Object.assign(payload, extraForPlayer);
    }
    io.to(sid).emit('game_state', payload);
  });
  broadcastSpectators(room);
  // Schedule bot turn if needed (no-op for non-PVE rooms)
  scheduleBotTurn(room);
}

function broadcastLobby(room) {
  io.to(room.code).emit('room_updated', {
    code: room.code, hostId: room.hostId, status: 'waiting',
    players: room.players.map(p => ({ id: p.id, name: p.name })),
    eventsEnabled: room.eventsEnabled ?? false,
  });
}

function broadcastSpectators(room) {
  if (!room.game || !room.spectators?.length) return;
  const game = sanitizeGameForSpectator(room.game);
  room.spectators.forEach((s, i) => {
    io.to(s.currentSocketId || s.id).emit('spectator_state', {
      code: room.code, game, queuePosition: i + 1,
    });
  });
}

// ── Socket events ─────────────────────────────────────────────────────────────

io.on('connection', socket => {
  const pid = socket.handshake.auth?.pid || null;
  if (pid) socket._pid = pid;

  // ── Reconnection restore ──────────────────────────────────────────────────
  if (pid && pidSessions.has(pid)) {
    // Cancel the grace-period removal timer
    if (disconnectTimers.has(pid)) {
      clearTimeout(disconnectTimers.get(pid));
      disconnectTimers.delete(pid);
    }

    const { roomCode, playerId } = pidSessions.get(pid);
    const room = getRoomByCode(roomCode);

    if (room) {
      const player    = room.players.find(p => p.id === playerId);
      const spectator = room.spectators?.find(s => s.id === playerId);

      if (player) {
        player.currentSocketId = socket.id;
        socket.join(roomCode);
        if (room.game) {
          const _rNow = Date.now();
          const _rHasTimer = room._timerStartedAt && !NO_TIMER_PHASES.includes(room.game.phase) && room.game.phase !== 'GAME_OVER';
          const _rRemaining = _rHasTimer
            ? Math.max(0, Math.ceil((room._timerStartedAt + TURN_TIMEOUT_MS - _rNow) / 1000))
            : null;
          socket.emit('game_state', {
            code: room.code, hostId: room.hostId, status: 'playing',
            game: sanitizeGame(room.game, playerId), reconnected: true, playerId,
            timerStartedAt: room._timerStartedAt || null,
            timeRemaining: _rRemaining,
            musicTrack: room.musicTrack || 'none',
            musicLastChanged: room.musicLastChanged || 0,
          });
        } else {
          socket.emit('room_updated', {
            code: room.code, hostId: room.hostId, status: 'waiting',
            players: room.players.map(p => ({ id: p.id, name: p.name })),
            reconnected: true, playerId,
          });
        }
        attachGameHandlers(socket);
        return;
      }

      if (spectator) {
        spectator.currentSocketId = socket.id;
        socket.join(roomCode);
        if (room.game) {
          socket.emit('spectator_joined', {
            code: room.code, game: sanitizeGameForSpectator(room.game),
            queuePosition: room.spectators.indexOf(spectator) + 1,
            reconnected: true,
          });
        }
        attachGameHandlers(socket);
        return;
      }
    }

    // Session stale (room/player gone) — clean up and let them re-enter normally
    pidSessions.delete(pid);
    socket.emit('session_expired');
  }

  // ── Normal events ─────────────────────────────────────────────────────────

  /**
   * Ensures the player leaves any current room before creating/joining a new one.
   * Prevents the "dois jogos conectados" bug where a player receives game_state
   * from two rooms simultaneously.
   */
  function autoLeaveCurrentRoom() {
    const existing = getRoomByPlayer(socket.id);
    if (!existing) return;
    const player = existing.players.find(p => p.id === socket.id || p.currentSocketId === socket.id);
    if (!player) return;
    if (existing.isPve) clearBotTimer(existing.code);
    const playerId = player.id;
    removePlayerFromRoom(existing.code, playerId);
    socket.leave(existing.code);
    if (pid) { clearTimeout(disconnectTimers.get(pid)); disconnectTimers.delete(pid); pidSessions.delete(pid); }
    // If game was in progress, eliminate that player's cards and check win
    const liveRoom = getRoomByCode(existing.code);
    if (liveRoom?.game) {
      const gp = liveRoom.game.players.find(p => p.id === playerId);
      if (gp) gp.cards.forEach(c => { c.dead = true; });
      const alive = liveRoom.game.players.filter(p => p.cards.some(c => !c.dead));
      if (alive.length === 1 && liveRoom.game.phase !== 'GAME_OVER') {
        liveRoom.game.winner = alive[0].id;
        liveRoom.game.phase  = 'GAME_OVER';
      }
      if (liveRoom.players.filter(p => !p.isBot).length > 0) broadcast(liveRoom);
    }
  }

  socket.on('create_room', ({ playerName }, cb) => {
    autoLeaveCurrentRoom();
    const room = createRoom(socket.id, playerName, pid);
    socket.join(room.code);
    if (pid) pidSessions.set(pid, { roomCode: room.code, playerId: socket.id });
    cb?.({ success: true, room: generateRoomForClient(room) });
  });

  socket.on('create_pve_room', ({ playerName, difficulty }, cb) => {
    autoLeaveCurrentRoom();
    const diff = ['estagiario', 'clt', 'patrao', 'deputado', 'dono_morro'].includes(difficulty)
      ? difficulty : 'estagiario';
    const room = createPveRoom(socket.id, playerName, pid, diff);
    socket.join(room.code);
    if (pid) pidSessions.set(pid, { roomCode: room.code, playerId: socket.id });
    // Start game immediately — bots are already in room.players
    startGameInRoom(room);
    broadcast(room); // triggers scheduleBotTurn if bot goes first
    cb?.({ success: true, room: generateRoomForClient(room) });
  });

  /**
   * request_join — used by guests wanting to enter a room.
   * Host is notified and must approve/deny.
   * If the player already has a pid session for this room they are auto-restored (handled
   * in the reconnect block above), so this path is only reached for brand-new players.
   */
  socket.on('request_join', ({ code, playerName }, cb) => {
    const upper = (code || '').toUpperCase();
    const room  = getRoomByCode(upper);
    if (!room) return cb?.({ success: false, error: 'Sala não encontrada' });

    // ── Game in progress → auto-approve as spectator (enters next round) ──
    if (room.game) {
      if (room.spectators.find(s => s.id === socket.id || s.currentSocketId === socket.id))
        return cb?.({ success: true, status: 'spectating' }); // already spectating
      const specName = (playerName || 'Espectador').slice(0, 20);
      room.spectators.push({ id: socket.id, name: specName, currentSocketId: socket.id });
      socket.join(upper);
      if (pid) pidSessions.set(pid, { roomCode: upper, playerId: socket.id });
      socket.emit('spectator_joined', {
        code: room.code, game: sanitizeGameForSpectator(room.game),
        queuePosition: room.spectators.length,
      });
      return cb?.({ success: true, status: 'spectating' });
    }

    if (room.players.length >= 6) return cb?.({ success: false, error: 'Sala cheia' });

    // Already in room (edge case: player somehow double-requests)
    if (room.players.find(p => p.currentSocketId === socket.id || p.id === socket.id)) {
      socket.join(upper);
      return cb?.({ success: true, status: 'already_in' });
    }

    // Is this the host reconnecting without a pid session?
    // Emit join_approved so App.jsx handles it like any other approval.
    if (pid && pid === room.hostPid) {
      const result = joinRoom(upper, socket.id, playerName);
      if (!result.success) return cb?.({ success: false, error: result.error });
      socket.join(upper);
      pidSessions.set(pid, { roomCode: upper, playerId: socket.id });
      broadcastLobby(room);
      socket.emit('join_approved', { room: generateRoomForClient(room), playerId: socket.id });
      return cb?.({ success: true, status: 'pending' }); // client stays in 'requesting' until join_approved fires
    }

    // Normal request — wait for host approval
    const requestId = Math.random().toString(36).slice(2, 9);
    room.pendingRequests.push({ requestId, socketId: socket.id, playerName: (playerName || 'Jogador').slice(0, 20) });

    // Notify host
    const host = room.players.find(p => p.id === room.hostId);
    if (host) {
      const hostSid = host.currentSocketId || host.id;
      io.to(hostSid).emit('join_request', { requestId, playerName: room.pendingRequests.at(-1).playerName });
    }

    cb?.({ success: true, status: 'pending' });
  });

  attachGameHandlers(socket);
});

function attachGameHandlers(socket) {
  /**
   * Resolve the stable game player id from either the original socket id or
   * the updated currentSocketId (after reconnect).
   */
  function resolvePlayerId() {
    const room = getRoomByPlayer(socket.id);
    if (!room) return socket.id;
    const p = room.players.find(rp => rp.id === socket.id || rp.currentSocketId === socket.id);
    return p ? p.id : socket.id;
  }

  function withRoom(cb) {
    return (payload, ack) => {
      try {
        const room = getRoomByPlayer(socket.id);
        if (!room?.game) return ack?.({ success: false, error: 'Sala não encontrada' });
        const playerId = resolvePlayerId();
        const result = cb(room, payload, playerId);
        broadcast(room);
        ack?.({ success: result?.success ?? true, error: result?.error });
      } catch (err) {
        console.error('[withRoom] erro inesperado:', err);
        ack?.({ success: false, error: 'Erro interno do servidor' });
      }
    };
  }

  socket.on('start_game', (_, cb) => {
    const room = getRoomByPlayer(socket.id);
    if (!room) return cb?.({ success: false, error: 'Sala não encontrada' });
    const caller = room.players.find(p => p.id === socket.id || p.currentSocketId === socket.id);
    if (!caller || room.hostId !== caller.id) return cb?.({ success: false, error: 'Só o host pode iniciar' });
    if (room.players.length < 2) return cb?.({ success: false, error: 'Mínimo 2 jogadores' });
    // Discard any pending join requests — they'll spectate or wait for next round
    room.pendingRequests = [];
    startGameInRoom(room);
    broadcast(room);
    cb?.({ success: true });
  });

  socket.on('approve_join', ({ requestId }, cb) => {
    const room = getRoomByPlayer(socket.id);
    if (!room) return cb?.({ success: false });
    const caller = room.players.find(p => p.id === socket.id || p.currentSocketId === socket.id);
    if (!caller || caller.id !== room.hostId) return cb?.({ success: false, error: 'Não autorizado' });

    const idx = room.pendingRequests.findIndex(r => r.requestId === requestId);
    if (idx === -1) return cb?.({ success: false, error: 'Solicitação não encontrada' });
    const req = room.pendingRequests.splice(idx, 1)[0];

    const guestSocket = io.sockets.sockets.get(req.socketId);

    // ── Game already started while request was pending → add as spectator ──
    if (room.game) {
      if (guestSocket) {
        const already = room.spectators.find(s => s.id === req.socketId || s.currentSocketId === req.socketId);
        if (!already) {
          room.spectators.push({ id: req.socketId, name: req.playerName, currentSocketId: req.socketId });
          guestSocket.join(room.code);
          const guestPid = guestSocket._pid;
          if (guestPid) pidSessions.set(guestPid, { roomCode: room.code, playerId: req.socketId });
          guestSocket.emit('spectator_joined', {
            code: room.code, game: sanitizeGameForSpectator(room.game),
            queuePosition: room.spectators.length,
          });
        }
      }
      return cb?.({ success: true });
    }

    // ── Normal lobby join ─────────────────────────────────────────────────
    const result = joinRoom(room.code, req.socketId, req.playerName);
    if (!result.success) return cb?.({ success: false, error: result.error });

    if (guestSocket) {
      guestSocket.join(room.code);
      const guestPid = guestSocket._pid;
      if (guestPid) pidSessions.set(guestPid, { roomCode: room.code, playerId: req.socketId });
      guestSocket.emit('join_approved', {
        room: generateRoomForClient(room),
        playerId: req.socketId,
      });
    }

    broadcastLobby(room);
    cb?.({ success: true });
  });

  socket.on('deny_join', ({ requestId }, cb) => {
    const room = getRoomByPlayer(socket.id);
    if (!room) return cb?.({ success: false });
    const caller = room.players.find(p => p.id === socket.id || p.currentSocketId === socket.id);
    if (!caller || caller.id !== room.hostId) return cb?.({ success: false, error: 'Não autorizado' });

    const idx = room.pendingRequests.findIndex(r => r.requestId === requestId);
    if (idx === -1) return cb?.({ success: false });
    const req = room.pendingRequests.splice(idx, 1)[0];

    io.to(req.socketId).emit('join_denied', { reason: 'Host negou sua entrada na sala' });
    cb?.({ success: true });
  });

  /** Player voluntarily leaves — immediate removal, no grace period */
  socket.on('leave_room', (_, cb) => {
    const pid = socket._pid;
    // If PVE room, cancel any pending bot timers
    const _lr = getRoomByPlayer(socket.id);
    if (_lr?.isPve) clearBotTimer(_lr.code);

    // Remove from players
    const room = getRoomByPlayer(socket.id);
    if (room) {
      const player = room.players.find(p => p.id === socket.id || p.currentSocketId === socket.id);
      if (player) {
        if (pid) { clearTimeout(disconnectTimers.get(pid)); disconnectTimers.delete(pid); pidSessions.delete(pid); }
        const gameInProgress = !!room.game;
        const leavingPlayerId = player.id;
        removePlayerFromRoom(room.code, player.id);
        const liveRoom = getRoomByCode(room.code);
        if (liveRoom) {
          if (gameInProgress && liveRoom.game) {
            // Eliminate all cards of the leaving player
            const gamePlayer = liveRoom.game.players.find(p => p.id === leavingPlayerId);
            if (gamePlayer) {
              gamePlayer.cards.forEach(c => { c.dead = true; });
              liveRoom.game.log.push(`${gamePlayer.name} saiu da partida. ⬅️`);
            }
            // If it was their turn, advance
            if (liveRoom.game.currentPlayerId === leavingPlayerId && liveRoom.game.phase === 'ACTION_SELECT') {
              const alive = getAlivePlayers(liveRoom.game);
              if (alive.length <= 1) {
                liveRoom.game.winner = alive[0]?.id || null;
                liveRoom.game.phase = 'GAME_OVER';
              } else {
                const idx = alive.findIndex(p => p.id === leavingPlayerId);
                const next = alive[Math.max(idx, 0) % alive.length] || alive[0];
                liveRoom.game.currentPlayerId = next.id;
              }
            }
            // Check game over
            const alive2 = liveRoom.game.players.filter(p => p.cards.some(c => !c.dead));
            if (alive2.length === 1 && liveRoom.game.phase !== 'GAME_OVER') {
              liveRoom.game.winner = alive2[0].id;
              liveRoom.game.phase = 'GAME_OVER';
            }
            broadcast(liveRoom);
          } else if (liveRoom.players.length > 0 && !liveRoom.game) {
            broadcastLobby(liveRoom);
          }
        }
      }
      // Also remove from spectators
      if (room.spectators) {
        const si = room.spectators.findIndex(s => s.id === socket.id || s.currentSocketId === socket.id);
        if (si >= 0) room.spectators.splice(si, 1);
      }
      socket.leave(room.code);
    }

    if (pid) { pidSessions.delete(pid); }
    cb?.({ success: true });
  });

  socket.on('take_action', (payload, ack) => {
    try {
      const room = getRoomByPlayer(socket.id);
      if (!room?.game) return ack?.({ success: false, error: 'Sala não encontrada' });
      const playerId = resolvePlayerId();
      // Double-tap guard: reject if same player fired within cooldown window
      const now = Date.now();
      const lastAt = actionCooldowns.get(playerId) || 0;
      if (now - lastAt < ACTION_COOLDOWN_MS) {
        return ack?.({ success: false, error: 'Aguarde um momento antes de agir novamente' });
      }
      actionCooldowns.set(playerId, now);
      const result = handleAction(room, playerId, payload?.action, payload?.targetId, { accusedCharacter: payload?.accusedCharacter });
      broadcast(room);
      ack?.({ success: result?.success ?? true, error: result?.error });
    } catch (err) {
      console.error('[take_action] erro:', err);
      ack?.({ success: false, error: 'Erro interno do servidor' });
    }
  });
  socket.on('challenge',             withRoom((room, _, pid) => handleChallenge(room, pid)));
  socket.on('block',                 withRoom((room, { character }, pid) => handleBlock(room, pid, character)));
  socket.on('pass',                  withRoom((room, _, pid) => handlePass(room, pid)));
  socket.on('lose_influence',        withRoom((room, { cardIndex }, pid) => handleLoseInfluence(room, pid, cardIndex)));
  socket.on('flip_coin',             withRoom((room, _, pid) => handleFlipCoin(room, pid)));
  socket.on('acknowledge_coin_flip', withRoom((room, _, pid) => handleAcknowledgeCoinFlip(room, pid)));
  socket.on('select_card_show',      withRoom((room, { cardIndex }, pid) => handleSelectCardShow(room, pid, cardIndex)));
  socket.on('acknowledge_peek',      withRoom((room, _, pid) => handleAcknowledgePeek(room, pid)));
  socket.on('select_card_swap',      withRoom((room, { cardIndex }, pid) => handleSelectCardSwap(room, pid, cardIndex)));
  socket.on('select_disfarce',       withRoom((room, { myCardIndex, pickedOption }, pid) => handleSelectDisfarce(room, pid, { myCardIndex, pickedOption })));
  socket.on('challenge_won_choice',  withRoom((room, { wantsSwap }, pid) => handleChallengeWonChoice(room, pid, !!wantsSwap)));

  socket.on('quick_chat', (payload, ack) => {
    try {
      const room = getRoomByPlayer(socket.id);
      if (!room?.game) return ack?.({ success: false });
      const playerId = resolvePlayerId();
      const QUICK_MSGS = ['MENTIROSO 🤡', 'CONFIA 😂', 'me rouba não 😭', 'X9 safado 👀', 'FAZ O L 🇧🇷'];
      const msg = QUICK_MSGS[payload?.msgIndex];
      if (!msg) return ack?.({ success: false });
      // Broadcast to all players in the room
      room.players.forEach(p => {
        io.to(p.currentSocketId || p.id).emit('quick_chat', { playerId, message: msg });
      });
      ack?.({ success: true });
    } catch (e) {
      console.error('[quick_chat] error:', e);
      ack?.({ success: false });
    }
  });

  socket.on('restart_game', (_, cb) => {
    const room = getRoomByPlayer(socket.id);
    if (!room) return cb?.({ success: false });
    const caller = room.players.find(p => p.id === socket.id || p.currentSocketId === socket.id);
    if (!caller || caller.id !== room.hostId) return cb?.({ success: false, error: 'Só o host pode reiniciar' });
    clearTurnTimer(room.code);
    clearBotTimer(room.code);
    room._lastPhase         = null;
    room._lastCurrentPlayer = null;
    if (!room.isPve) {
      // Only promote spectators in non-PVE rooms
      const slots = Math.max(0, 6 - room.players.length);
      const promoted = (room.spectators || []).splice(0, slots);
      promoted.forEach(s => room.players.push({ id: s.id, name: s.name, currentSocketId: s.currentSocketId || s.id }));
    }
    startGameInRoom(room);
    broadcast(room);
    cb?.({ success: true });
  });

  // Host alterna Modo TikTok (eventos) antes de iniciar
  socket.on('set_events', ({ enabled }, cb) => {
    const room = getRoomByPlayer(socket.id);
    if (!room) return cb?.({ success: false, error: 'Sala não encontrada' });
    if (room.game) return cb?.({ success: false, error: 'Partida já em andamento' });
    const caller = room.players.find(p => p.id === socket.id || p.currentSocketId === socket.id);
    if (!caller || caller.id !== room.hostId) return cb?.({ success: false, error: 'Só o host pode alterar' });
    room.eventsEnabled = !!enabled;
    broadcastLobby(room);
    cb?.({ success: true });
  });

  // ── Jukebox: troca música sincronizada (3 min cooldown, ou 1 moeda para pular) ──
  socket.on('change_music', ({ trackId, payCoins }, cb) => {
    const room = getRoomByPlayer(socket.id);
    if (!room) return cb?.({ success: false, error: 'Sala não encontrada' });

    const now = Date.now();
    const THREE_MIN = 3 * 60 * 1000;
    const timeSince = now - (room.musicLastChanged || 0);
    const inCooldown = timeSince < THREE_MIN;
    const remaining = inCooldown ? Math.ceil((THREE_MIN - timeSince) / 1000) : 0;

    if (inCooldown && !payCoins) {
      return cb?.({ success: false, error: 'cooldown', remaining });
    }

    if (inCooldown && payCoins) {
      const player = room.game?.players.find(
        p => p.currentSocketId === socket.id || p.id === socket.id
      );
      if (!player) return cb?.({ success: false, error: 'Só pode pagar dentro de uma partida' });
      if (player.coins < 1) return cb?.({ success: false, error: 'Sem moedas suficientes' });
      player.coins -= 1;
      broadcast(room);
    }

    room.musicTrack = trackId;
    room.musicLastChanged = now;

    const changerName =
      room.game?.players.find(p => p.currentSocketId === socket.id || p.id === socket.id)?.name ||
      room.players.find(p => p.id === socket.id || p.currentSocketId === socket.id)?.name ||
      '?';

    // ── Big Fone: primeiro a tocar/trocar música neste round ganha 2 moedas ──
    if (room.game && room.game.activeEvent?.type === 'big_fone' && !room.game.activeEvent.bigFoneClaimed) {
      const winner = room.game.players.find(p => p.id === socket.id || p.currentSocketId === socket.id);
      if (winner && winner.cards.some(c => !c.dead)) {
        room.game.activeEvent.bigFoneClaimed = true;
        winner.coins += 2;
        room.game.log.push(`📞 BIG FONE! ${winner.name} tocou a música primeiro e ganhou 2 moedas! 🎶💰`);
        broadcast(room);
      }
    }

    io.to(room.code).emit('music_changed', {
      trackId,
      changedBy: changerName,
      lastChanged: now,
      paidCoin: !!(inCooldown && payCoins),
    });

    cb?.({ success: true });
  });

  // Lista todas as salas com pelo menos 1 jogador (aguardando ou em andamento)
  socket.on('list_rooms', (_, cb) => {
    const open = Object.values(rooms)
      .filter(r => r.players.length >= 1)
      .map(r => ({
        code: r.code,
        playerCount: r.players.length,
        hostName: r.players.find(p => p.id === r.hostId)?.name || '?',
        eventsEnabled: r.eventsEnabled ?? false,
        status: r.game ? 'playing' : 'waiting',
      }));
    cb?.({ success: true, rooms: open });
  });

  socket.on('disconnect', () => {
    // Handle spectator disconnect — just remove immediately (no grace period)
    for (const room of Object.values(rooms)) {
      const si = room.spectators?.findIndex(s => s.id === socket.id || s.currentSocketId === socket.id);
      if (si >= 0) { room.spectators.splice(si, 1); break; }
    }

    // Find the room and the stable player id
    const room = getRoomByPlayer(socket.id);
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id || p.currentSocketId === socket.id);
    if (!player) return;
    const playerId = player.id;
    const roomCode = room.code;

    const pid = socket._pid;

    if (pid) {
      // Grace period: give the player 30 s to reconnect before removing them
      const timer = setTimeout(() => {
        removePlayerFromRoom(roomCode, playerId);
        pidSessions.delete(pid);
        disconnectTimers.delete(pid);

        const liveRoom = getRoomByCode(roomCode);
        if (liveRoom && liveRoom.players.length > 0 && !liveRoom.game) {
          broadcastLobby(liveRoom);
        }
        console.log('grace period expired, removed player:', playerId);
      }, GRACE_PERIOD_MS);

      disconnectTimers.set(pid, timer);
    } else {
      // No pid, remove immediately (old behavior)
      removePlayerFromRoom(roomCode, playerId);
      const liveRoom = getRoomByCode(roomCode);
      if (liveRoom && liveRoom.players.length > 0 && !liveRoom.game) broadcastLobby(liveRoom);
    }
  });
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Servidor GOLPE rodando na porta ${PORT}`));
