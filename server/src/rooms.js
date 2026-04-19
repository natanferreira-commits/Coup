const { v4: uuidv4 } = require('uuid');
const { createDeck } = require('./game/deck');

const rooms = {};

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function createRoom(hostId, hostName, hostPid) {
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
  const deck = createDeck();
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
    log: [`--- Partida iniciada! Vez de ${players[0].name} ---`],
    winner: null,
  };

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
  };
}

module.exports = { rooms, createRoom, joinRoom, startGame, removePlayerFromRoom, getRoomByPlayer, getRoomByCode, generateRoomForClient };
