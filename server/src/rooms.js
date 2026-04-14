const { v4: uuidv4 } = require('uuid');
const { createDeck } = require('./game/deck');

const rooms = {};

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function createRoom(hostId, hostName) {
  let code;
  do { code = generateCode(); } while (rooms[code]);

  const room = {
    code,
    hostId,
    players: [{ id: hostId, name: hostName }],
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

  room.players.push({ id: playerId, name: playerName });
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

function getRoomByPlayer(socketId) {
  for (const room of Object.values(rooms)) {
    if (room.players.find(p => p.id === socketId)) return room;
  }
  return null;
}

module.exports = { rooms, createRoom, joinRoom, startGame, removePlayerFromRoom, getRoomByPlayer };
