const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const {
  rooms,
  createRoom, joinRoom, startGame: startGameInRoom,
  removePlayerFromRoom, getRoomByPlayer, getRoomByCode, generateRoomForClient,
} = require('./rooms');
const {
  handleAction, handlePass, handleBlock, handleChallenge,
  handleLoseInfluence, handleSelectCardShow, handleAcknowledgePeek, handleSelectCardSwap,
} = require('./game/engine');

const app = express();
app.use(cors());
app.use(express.json());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

app.get('/health', (_, res) => res.json({ ok: true }));

// ── Reconnection state ────────────────────────────────────────────────────────

/** pid → { roomCode, playerId (original socket id) } */
const pidSessions = new Map();

/** pid → setTimeout handle (30 s grace period before removing player) */
const disconnectTimers = new Map();

const GRACE_PERIOD_MS = 30_000;

// ── Sanitize ─────────────────────────────────────────────────────────────────

function sanitizeGame(game, playerId) {
  return {
    players: game.players.map(p => ({
      id: p.id, name: p.name, coins: p.coins,
      alive: p.cards.some(c => !c.dead),
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
  };
}

/** Spectators see the game without any hidden card info */
function sanitizeGameForSpectator(game) {
  return {
    players: game.players.map(p => ({
      id: p.id, name: p.name, coins: p.coins,
      alive: p.cards.some(c => !c.dead),
      cards: p.cards.map((c, i) => ({ index: i, dead: c.dead, character: c.dead ? c.character : null })),
    })),
    currentPlayerId: game.currentPlayerId,
    phase: game.phase,
    pendingAction: game.pendingAction ? {
      type: game.pendingAction.type, actorId: game.pendingAction.actorId,
      targetId: game.pendingAction.targetId, claimedCharacter: game.pendingAction.claimedCharacter,
      blocker: game.pendingAction.blocker,
    } : null,
    log: game.log.slice(-25),
    winner: game.winner,
  };
}

function sanitizePA(pa, playerId) {
  if (!pa) return null;
  const base = {
    type: pa.type, actorId: pa.actorId, targetId: pa.targetId,
    claimedCharacter: pa.claimedCharacter, blocker: pa.blocker,
    respondedPlayers: pa.respondedPlayers, loseInfluenceQueue: pa.loseInfluenceQueue,
    swapPlayerId: pa.swapPlayerId, swapContext: pa.swapContext,
  };
  if (pa.x9Result && pa.actorId === playerId) base.x9Result = pa.x9Result;
  return base;
}

/**
 * Broadcast the current game state to all players in the room.
 * Uses player.currentSocketId so reconnected players receive messages on their new socket.
 * Optional extra fields (e.g. { reconnected, playerId }) are merged into the payload for one player.
 */
function broadcast(room, extraForPlayer = null) {
  room.players.forEach(p => {
    if (!room.game) return;
    const sid = p.currentSocketId || p.id;
    const payload = {
      code: room.code, hostId: room.hostId, status: 'playing',
      game: sanitizeGame(room.game, p.id),
    };
    if (extraForPlayer && extraForPlayer.playerId === p.id) {
      Object.assign(payload, extraForPlayer);
    }
    io.to(sid).emit('game_state', payload);
  });
  broadcastSpectators(room); // keep spectators in sync too
}

function broadcastLobby(room) {
  io.to(room.code).emit('room_updated', {
    code: room.code, hostId: room.hostId, status: 'waiting',
    players: room.players.map(p => ({ id: p.id, name: p.name })),
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

  console.log('connected:', socket.id, pid ? `(pid: ${pid.slice(0, 8)}…)` : '');

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
          socket.emit('game_state', {
            code: room.code, hostId: room.hostId, status: 'playing',
            game: sanitizeGame(room.game, playerId), reconnected: true, playerId,
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

  socket.on('create_room', ({ playerName }, cb) => {
    const room = createRoom(socket.id, playerName, pid);
    socket.join(room.code);
    if (pid) pidSessions.set(pid, { roomCode: room.code, playerId: socket.id });
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
      const room = getRoomByPlayer(socket.id);
      if (!room?.game) return ack?.({ success: false });
      const playerId = resolvePlayerId();
      const result = cb(room, payload, playerId);
      broadcast(room);
      ack?.({ success: result?.success ?? true, error: result?.error });
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

    // Remove from players
    const room = getRoomByPlayer(socket.id);
    if (room) {
      const player = room.players.find(p => p.id === socket.id || p.currentSocketId === socket.id);
      if (player) {
        if (pid) { clearTimeout(disconnectTimers.get(pid)); disconnectTimers.delete(pid); pidSessions.delete(pid); }
        removePlayerFromRoom(room.code, player.id);
        const liveRoom = getRoomByCode(room.code);
        if (liveRoom?.players.length > 0 && !liveRoom.game) broadcastLobby(liveRoom);
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

  socket.on('restart_game', (_, cb) => {
    const room = getRoomByPlayer(socket.id);
    if (!room) return cb?.({ success: false });

    // Promote spectators to players for the new round (up to 6 total)
    const slots = Math.max(0, 6 - room.players.length);
    const promoted = (room.spectators || []).splice(0, slots);
    promoted.forEach(s => room.players.push({ id: s.id, name: s.name, currentSocketId: s.currentSocketId || s.id }));

    startGameInRoom(room);
    broadcast(room);
    cb?.({ success: true });
  });

  socket.on('take_action',       withRoom((room, { action, targetId }, pid) => handleAction(room, pid, action, targetId)));
  socket.on('challenge',         withRoom((room, _, pid) => handleChallenge(room, pid)));
  socket.on('block',             withRoom((room, { character }, pid) => handleBlock(room, pid, character)));
  socket.on('pass',              withRoom((room, _, pid) => handlePass(room, pid)));
  socket.on('lose_influence',    withRoom((room, { cardIndex }, pid) => handleLoseInfluence(room, pid, cardIndex)));
  socket.on('select_card_show',  withRoom((room, { cardIndex }, pid) => handleSelectCardShow(room, pid, cardIndex)));
  socket.on('acknowledge_peek',  withRoom((room, _, pid) => handleAcknowledgePeek(room, pid)));
  socket.on('select_card_swap',  withRoom((room, { cardIndex }, pid) => handleSelectCardSwap(room, pid, cardIndex)));

  socket.on('disconnect', () => {
    console.log('disconnected:', socket.id);

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
