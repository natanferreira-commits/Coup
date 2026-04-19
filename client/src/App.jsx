import { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import socket from './socket';
import Landing from './screens/Landing';
import Lobby   from './screens/Lobby';
import SalaPage from './screens/SalaPage';

export default function App() {
  const navigate = useNavigate();

  const [roomData,         setRoomData]         = useState(null);
  const [gameData,         setGameData]         = useState(null);
  const [myPlayerId,       setMyPlayerId]       = useState(null);
  const [pendingRequests,  setPendingRequests]  = useState([]); // join requests (host sees)
  const [isReconnecting,   setIsReconnecting]   = useState(false);

  const gameDataRef  = useRef(gameData);
  const roomDataRef  = useRef(roomData);
  const reconnTimerRef = useRef(null);

  useEffect(() => { gameDataRef.current = gameData; }, [gameData]);
  useEffect(() => { roomDataRef.current = roomData; }, [roomData]);

  useEffect(() => {
    // ── Room lobby updates ────────────────────────────────────────────────
    socket.on('room_updated', data => {
      setRoomData(data);
      // After reconnect: restore player id and cancel overlay
      if (data.reconnected && data.playerId) {
        setMyPlayerId(data.playerId);
        setIsReconnecting(false);
        clearTimeout(reconnTimerRef.current);
        navigate(`/sala/${data.code}`, { replace: true });
      }
      // Keep pending-requests list in sync with players now in room
      if (data.players) {
        const namesInRoom = new Set(data.players.map(p => p.name));
        setPendingRequests(prev => prev.filter(r => !namesInRoom.has(r.playerName)));
      }
    });

    // ── Game state updates ────────────────────────────────────────────────
    socket.on('game_state', data => {
      setGameData(data);
      if (data.reconnected && data.playerId) {
        setMyPlayerId(data.playerId);
        setIsReconnecting(false);
        clearTimeout(reconnTimerRef.current);
        navigate(`/sala/${data.code}`, { replace: true });
      }
    });

    // ── Someone approved to join (received by the guest) ─────────────────
    socket.on('join_approved', ({ room, playerId }) => {
      setRoomData(room);
      setMyPlayerId(playerId);
      navigate(`/sala/${room.code}`, { replace: true });
    });

    // ── Host receives a join request ──────────────────────────────────────
    socket.on('join_request', ({ requestId, playerName }) => {
      setPendingRequests(prev => [...prev, { requestId, playerName }]);
    });

    // ── Disconnect / reconnect ────────────────────────────────────────────
    socket.on('disconnect', () => {
      const inSession = gameDataRef.current || roomDataRef.current;
      if (inSession) {
        setIsReconnecting(true);
        reconnTimerRef.current = setTimeout(() => {
          setIsReconnecting(false);
          setRoomData(null);
          setGameData(null);
          setMyPlayerId(null);
          setPendingRequests([]);
          navigate('/', { replace: true });
        }, 12_000);
      } else {
        navigate('/', { replace: true });
      }
    });

    socket.on('session_expired', () => {
      clearTimeout(reconnTimerRef.current);
      setIsReconnecting(false);
      setRoomData(null);
      setGameData(null);
      setMyPlayerId(null);
      setPendingRequests([]);
      navigate('/', { replace: true });
    });

    return () => {
      socket.off('room_updated');
      socket.off('game_state');
      socket.off('join_approved');
      socket.off('join_request');
      socket.off('disconnect');
      socket.off('session_expired');
    };
  }, [navigate]);

  // ── Host approve / deny helpers ───────────────────────────────────────────
  function handleApprove(requestId) {
    socket.emit('approve_join', { requestId }, res => {
      if (res?.success) {
        setPendingRequests(prev => prev.filter(r => r.requestId !== requestId));
      }
    });
  }

  function handleDeny(requestId) {
    socket.emit('deny_join', { requestId }, res => {
      if (res?.success) {
        setPendingRequests(prev => prev.filter(r => r.requestId !== requestId));
      }
    });
  }

  // ── Host creates room (callback from Lobby) ───────────────────────────────
  function handleRoomCreated(room, name) {
    setMyPlayerId(socket.id);
    setRoomData(room);
    navigate(`/sala/${room.code}`);
  }

  // ── Reconnecting overlay ──────────────────────────────────────────────────
  const reconnOverlay = isReconnecting && (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.78)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 16, backdropFilter: 'blur(6px)',
    }}>
      <div style={{
        width: 48, height: 48,
        border: '4px solid rgba(255,255,255,0.15)',
        borderTop: '4px solid #ffd600',
        borderRadius: '50%',
        animation: 'spin 0.9s linear infinite',
      }} />
      <p style={{ color: '#fff', fontSize: 18, fontWeight: 600, margin: 0 }}>
        Reconectando…
      </p>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: 0 }}>
        Aguenta aí, você vai voltar pra partida
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  // ── Routes ────────────────────────────────────────────────────────────────
  return (
    <>
      {reconnOverlay}
      <Routes>
        <Route path="/"      element={<Landing onEnter={() => navigate('/lobby')} />} />
        <Route path="/lobby" element={<Lobby onCreated={handleRoomCreated} />} />
        <Route
          path="/sala/:code"
          element={
            <SalaPage
              roomData={roomData}
              gameData={gameData}
              myPlayerId={myPlayerId}
              pendingRequests={pendingRequests}
              onApprove={handleApprove}
              onDeny={handleDeny}
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
