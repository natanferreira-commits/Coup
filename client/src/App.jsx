import { useState, useEffect } from 'react';
import socket from './socket';
import Landing from './screens/Landing';
import Lobby from './screens/Lobby';
import Room from './screens/Room';
import Game from './screens/Game';

export default function App() {
  const [screen, setScreen] = useState('landing'); // 'landing' | 'lobby' | 'room' | 'game'
  const [roomData, setRoomData] = useState(null);
  const [gameData, setGameData] = useState(null);
  const [playerName, setPlayerName] = useState('');

  useEffect(() => {
    socket.on('room_updated', data => {
      setRoomData(data);
      if (data.status === 'waiting') setScreen('room');
    });

    socket.on('game_state', data => {
      setGameData(data);
      if (data.status === 'playing') setScreen('game');
    });

    socket.on('disconnect', () => {
      setScreen('lobby');
      setRoomData(null);
      setGameData(null);
    });

    return () => {
      socket.off('room_updated');
      socket.off('game_state');
      socket.off('disconnect');
    };
  }, []);

  if (screen === 'landing') {
    return <Landing onEnter={() => setScreen('lobby')} />;
  }

  if (screen === 'lobby') {
    return (
      <Lobby
        onJoined={(data, name) => {
          setPlayerName(name);
          setRoomData(data);
          setScreen('room');
        }}
      />
    );
  }

  if (screen === 'room') {
    return (
      <Room
        room={roomData}
        playerName={playerName}
        onGameStart={data => {
          setGameData(data);
          setScreen('game');
        }}
      />
    );
  }

  if (screen === 'game') {
    return (
      <Game
        data={gameData}
        myId={socket.id}
      />
    );
  }

  return null;
}
