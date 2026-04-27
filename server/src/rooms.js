const { v4: uuidv4 } = require('uuid');
const { createDeck } = require('./game/deck');
const { BOT_COUNTS, BOT_NAMES } = require('./game/bot');
// rollAndApplyRoundEvent é importado com require lazy para evitar dep circular
// (engine.js não importa rooms.js, então é seguro importar aqui)
let _rollAndApplyRoundEvent = null;
function getRollFn() {
  if (!_rollAndApplyRoundEvent) {
    _rollAndApplyRoundEvent = require('./game/engine').rollAndApplyRoundEvent;
  }
  return _rollAndApplyRoundEvent;
}

const rooms = {};

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function createRoom(hostId, hostName, hostPid, eventsEnabled = false) {
  let code;
  do { code = generateCode(); } while (rooms[code]);

  const room = {
    code,
    hostId,
    hostPid: hostPid || null,
    players: [{ id: hostId, name: hostName, currentSocketId: hostId }],
    spectators: [],      // [{ id, name, currentSocketId }] — watching, enter next round
    pendingRequests: [], // [{ requestId, socketId, playerName }]
    game: null,
    eventsEnabled: !!eventsEnabled,
  };

  rooms[code] = room;
  return room;
}

function createPveRoom(hostId, hostName, hostPid, difficulty = 'estagiario') {
  let code;
  do { code = generateCode(); } while (rooms[code]);

  const botCount = BOT_COUNTS[difficulty] ?? 2;
  const bots = [];
  for (let i = 0; i < botCount; i++) {
    const botId = `bot_${code}_${i}`;
    bots.push({
      id: botId,
      name: BOT_NAMES[i] || `Bot ${i + 1}`,
      currentSocketId: botId,
      isBot: true,
      botDifficulty: difficulty,
    });
  }

  const room = {
    code,
    hostId,
    hostPid: hostPid || null,
    players: [
      { id: hostId, name: hostName, currentSocketId: hostId },
      ...bots,
    ],
    spectators: [],
    pendingRequests: [],
    game: null,
    eventsEnabled: false,
    isPve: true,
    pveDifficulty: difficulty,
  };

  rooms[code] = room;
  return room;
}

function joinRoom(code, playerId, playerName) {
  const room = rooms[code];
  if (!room) return { success: false, error: 'Sala não encontrada' };
  if (room.game) return { success: false, error: 'Partida já em andamento' };
  if (room.players.length >= 6) return { success: false, error: 'Sala cheia' };
  if (room.players.find(p => p.id === playerId)) return { success: true, room };

  room.players.push({ id: playerId, name: playerName, currentSocketId: playerId });
  return { success: true, room };
}

function startGame(room) {
  const deck = createDeck(room.players.length);
  const players = room.players.map(p => ({
    id: p.id,
    name: p.name,
    coins: 1,
    cards: [
      { character: deck.pop(), dead: false },
      { character: deck.pop(), dead: false },
    ],
  }));

  room.game = {
    players,
    deck,
    currentPlayerId: players[0].id,
    phase: 'ACTION_SELECT',
    pendingAction: null,
    log: [],
    winner: null,
    // Sistema de rounds
    roundNumber: 1,
    roundActedPlayers: [],
    activeEvent: null,
    eventsEnabled: !!room.eventsEnabled,
  };

  // Log de início e evento do round 1
  room.game.log.push(`🇧🇷 PARTIDA INICIADA! Que vença o mais safado. Boa sorte pra ninguém.`);
  room.game.log.push(`━━━ 🔔 ROUND 1 ━━━`);
  if (room.eventsEnabled) getRollFn()(room.game);

  return room.game;
}

function removePlayerFromRoom(code, playerId) {
  const room = rooms[code];
  if (!room) return;
  room.players = room.players.filter(p => p.id !== playerId);
  if (room.players.length === 0) {
    delete rooms[code];
    return;
  }
  if (room.hostId === playerId) {
    room.hostId = room.players[0].id;
  }
}

/**
 * Find a room by either the player's original id or their current socket id.
 * This handles both normal use and post-reconnect use.
 */
function getRoomByPlayer(socketId) {
  for (const room of Object.values(rooms)) {
    if (room.players.find(p => p.id === socketId || p.currentSocketId === socketId)) return room;
  }
  return null;
}

function getRoomByCode(code) {
  return rooms[code] || null;
}

/** Serialise a room for the client (no internal fields like currentSocketId/hostPid/pendingRequests). */
function generateRoomForClient(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    status: 'waiting',
    players: room.players.map(p => ({ id: p.id, name: p.name })),
    eventsEnabled: room.eventsEnabled ?? false,
  };
}

module.exports = { rooms, createRoom, createPveRoom, joinRoom, startGame, removePlayerFromRoom, getRoomByPlayer, getRoomByCode, generateRoomForClient };
