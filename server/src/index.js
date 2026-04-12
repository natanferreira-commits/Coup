const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const {
  createRoom, joinRoom, startGame: startGameInRoom,
  removePlayerFromRoom, getRoomByPlayer,
} = require('./rooms');
const {
  handleAction, handlePass, handleBlock, handleChallenge,
  handleLoseInfluence, handleInvestigateDecision,
} = require('./game/engine');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.get('/health', (_, res) => res.json({ ok: true }));

// ─── Socket helpers ──────────────────────────────────────────────────────────

function sanitizeGameForPlayer(game, playerId) {
  return {
    players: game.players.map(p => ({
      id: p.id,
      name: p.name,
      coins: p.coins,
      cardCount: p.cards.filter(c => !c.dead).length,
      alive: p.cards.some(c => !c.dead),
      // Own cards are always visible; dead cards are visible to all
      cards: p.cards.map((c, i) => ({
        index: i,
        dead: c.dead,
        character: (p.id === playerId || c.dead) ? c.character : null,
      })),
    })),
    currentPlayerId: game.currentPlayerId,
    phase: game.phase,
    pendingAction: sanitizePendingAction(game.pendingAction, playerId, game),
    log: game.log.slice(-20),
    winner: game.winner,
  };
}

function sanitizePendingAction(pa, playerId, game) {
  if (!pa) return null;
  const base = {
    type: pa.type,
    actorId: pa.actorId,
    targetId: pa.targetId,
    claimedCharacter: pa.claimedCharacter,
    blocker: pa.blocker,
    respondedPlayers: pa.respondedPlayers,
    loseInfluenceQueue: pa.loseInfluenceQueue,
  };
  // Only send investigation peek to the actor
  if (pa.investigationPeek && pa.actorId === playerId) {
    base.investigationPeek = pa.investigationPeek;
  }
  return base;
}

function broadcastGameState(room) {
  room.players.forEach(p => {
    if (!room.game) return;
    io.to(p.id).emit('game_state', {
      code: room.code,
      hostId: room.hostId,
      status: 'playing',
      game: sanitizeGameForPlayer(room.game, p.id),
    });
  });
}

function broadcastLobby(room) {
  io.to(room.code).emit('room_updated', {
    code: room.code,
    hostId: room.hostId,
    status: 'waiting',
    players: room.players.map(p => ({ id: p.id, name: p.name })),
  });
}

// ─── Socket events ───────────────────────────────────────────────────────────

io.on('connection', socket => {
  console.log('connected:', socket.id);

  socket.on('create_room', ({ playerName }, cb) => {
    const room = createRoom(socket.id, playerName);
    socket.join(room.code);
    cb?.({ success: true, room: { code: room.code, hostId: room.hostId, players: room.players, status: 'waiting' } });
  });

  socket.on('join_room', ({ code, playerName }, cb) => {
    const result = joinRoom(code.toUpperCase(), socket.id, playerName);
    if (!result.success) return cb?.({ success: false, error: result.error });
    socket.join(code.toUpperCase());
    broadcastLobby(result.room);
    cb?.({ success: true, room: { code: result.room.code, hostId: result.room.hostId, players: result.room.players, status: 'waiting' } });
  });

  socket.on('start_game', (_, cb) => {
    const room = getRoomByPlayer(socket.id);
    if (!room) return cb?.({ success: false, error: 'Sala não encontrada' });
    if (room.hostId !== socket.id) return cb?.({ success: false, error: 'Apenas o host pode iniciar' });
    if (room.players.length < 2) return cb?.({ success: false, error: 'Mínimo 2 jogadores' });
    startGameInRoom(room);
    broadcastGameState(room);
    cb?.({ success: true });
  });

  socket.on('take_action', ({ action, targetId }, cb) => {
    const room = getRoomByPlayer(socket.id);
    if (!room?.game) return cb?.({ success: false });
    const result = handleAction(room, socket.id, action, targetId);
    if (!result.success) return cb?.({ success: false, error: result.error });
    broadcastGameState(room);
    cb?.({ success: true });
  });

  socket.on('challenge', (_, cb) => {
    const room = getRoomByPlayer(socket.id);
    if (!room?.game) return;
    const result = handleChallenge(room, socket.id);
    broadcastGameState(room);
    cb?.({ success: result.success });
  });

  socket.on('block', ({ character }, cb) => {
    const room = getRoomByPlayer(socket.id);
    if (!room?.game) return;
    const result = handleBlock(room, socket.id, character);
    if (!result.success) return cb?.({ success: false, error: result.error });
    broadcastGameState(room);
    cb?.({ success: true });
  });

  socket.on('pass', (_, cb) => {
    const room = getRoomByPlayer(socket.id);
    if (!room?.game) return;
    handlePass(room, socket.id);
    broadcastGameState(room);
    cb?.({ success: true });
  });

  socket.on('lose_influence', ({ cardIndex }, cb) => {
    const room = getRoomByPlayer(socket.id);
    if (!room?.game) return;
    const result = handleLoseInfluence(room, socket.id, cardIndex);
    broadcastGameState(room);
    cb?.({ success: result.success });
  });

  socket.on('investigate_decision', ({ forceSwap }, cb) => {
    const room = getRoomByPlayer(socket.id);
    if (!room?.game) return;
    const result = handleInvestigateDecision(room, socket.id, forceSwap);
    broadcastGameState(room);
    cb?.({ success: result.success });
  });

  socket.on('disconnect', () => {
    console.log('disconnected:', socket.id);
    const room = getRoomByPlayer(socket.id);
    if (!room) return;
    removePlayerFromRoom(room.code, socket.id);
    if (room.players.length > 0 && !room.game) broadcastLobby(room);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Servidor GOLPE rodando na porta ${PORT}`));
