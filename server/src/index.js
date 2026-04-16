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
  handleLoseInfluence, handleSelectCardShow, handleAcknowledgePeek, handleSelectCardSwap,
} = require('./game/engine');

const app = express();
app.use(cors());
app.use(express.json());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

app.get('/health', (_, res) => res.json({ ok: true }));

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

function broadcast(room) {
  room.players.forEach(p => {
    if (!room.game) return;
    io.to(p.id).emit('game_state', {
      code: room.code, hostId: room.hostId, status: 'playing',
      game: sanitizeGame(room.game, p.id),
    });
  });
}

function broadcastLobby(room) {
  io.to(room.code).emit('room_updated', {
    code: room.code, hostId: room.hostId, status: 'waiting',
    players: room.players.map(p => ({ id: p.id, name: p.name })),
  });
}

// ── Socket events ─────────────────────────────────────────────────────────────

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
    if (room.hostId !== socket.id) return cb?.({ success: false, error: 'Só o host pode iniciar' });
    if (room.players.length < 2) return cb?.({ success: false, error: 'Mínimo 2 jogadores' });
    startGameInRoom(room);
    broadcast(room);
    cb?.({ success: true });
  });

  function withRoom(cb) {
    return (payload, ack) => {
      const room = getRoomByPlayer(socket.id);
      if (!room?.game) return ack?.({ success: false });
      const result = cb(room, payload);
      broadcast(room);
      ack?.({ success: result?.success ?? true, error: result?.error });
    };
  }

  socket.on('restart_game', (_, cb) => {
    const room = getRoomByPlayer(socket.id);
    if (!room) return cb?.({ success: false });
    startGameInRoom(room);
    broadcast(room);
    cb?.({ success: true });
  });

  socket.on('take_action',       withRoom((room, { action, targetId }) => handleAction(room, socket.id, action, targetId)));
  socket.on('challenge',         withRoom(room => handleChallenge(room, socket.id)));
  socket.on('block',             withRoom((room, { character }) => handleBlock(room, socket.id, character)));
  socket.on('pass',              withRoom(room => handlePass(room, socket.id)));
  socket.on('lose_influence',    withRoom((room, { cardIndex }) => handleLoseInfluence(room, socket.id, cardIndex)));
  socket.on('select_card_show',  withRoom((room, { cardIndex }) => handleSelectCardShow(room, socket.id, cardIndex)));
  socket.on('acknowledge_peek',  withRoom(room => handleAcknowledgePeek(room, socket.id)));
  socket.on('select_card_swap',  withRoom((room, { cardIndex }) => handleSelectCardSwap(room, socket.id, cardIndex)));

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
