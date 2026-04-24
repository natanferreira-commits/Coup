import { useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import socket from './socket';
import Landing  from './screens/Landing';
import Lobby    from './screens/Lobby';
import SalaPage from './screens/SalaPage';

export default function App() {
  const navigate = useNavigate();

  const [roomData,        setRoomData]        = useState(null);
  const [gameData,        setGameData]        = useState(null);
  const [myPlayerId,      setMyPlayerId]      = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [isReconnecting,  setIsReconnecting]  = useState(false);

  // Spectator state
  const [isSpectator,   setIsSpectator]   = useState(false);
  const [spectatorData, setSpectatorData] = useState(null); // { code, game, queuePosition }

  const gameDataRef    = useRef(gameData);
  const roomDataRef    = useRef(roomData);
  const spectDataRef   = useRef(spectatorData);
  const reconnTimerRef = useRef(null);

  useEffect(() => { gameDataRef.current  = gameData;     }, [gameData]);
  useEffect(() => { roomDataRef.current  = roomData;     }, [roomData]);
  useEffect(() => { spectDataRef.current = spectatorData;}, [spectatorData]);

  useEffect(() => {
    socket.on('room_updated', data => {
      setRoomData(data);
      if (data.reconnected && data.playerId) {
        setMyPlayerId(data.playerId);
        setIsReconnecting(false);
        clearTimeout(reconnTimerRef.current);
        navigate(`/sala/${data.code}`, { replace: true });
      }
      if (data.players) {
        const namesInRoom = new Set(data.players.map(p => p.name));
        setPendingRequests(prev => prev.filter(r => !namesInRoom.has(r.playerName)));
      }
    });

    socket.on('game_state', data => {
      setGameData(data);
      // If we were spectating and now receive game_state, we've been promoted
      setIsSpectator(false);
      setSpectatorData(null);
      if (data.reconnected && data.playerId) {
        setMyPlayerId(data.playerId);
        setIsReconnecting(false);
        clearTimeout(reconnTimerRef.current);
        navigate(`/sala/${data.code}`, { replace: true });
      }
    });

    // ── Spectator events ──────────────────────────────────────────────────
    socket.on('spectator_joined', data => {
      setIsSpectator(true);
      setSpectatorData(data);
      if (data.code) navigate(`/sala/${data.code}`, { replace: true });
    });

    socket.on('spectator_state', data => {
      setSpectatorData(data);
    });

    // ── Guest approved ────────────────────────────────────────────────────
    socket.on('join_approved', ({ room, playerId }) => {
      setRoomData(room);
      setMyPlayerId(playerId);
      navigate(`/sala/${room.code}`, { replace: true });
    });

    // ── Host sees join requests ───────────────────────────────────────────
    socket.on('join_request', ({ requestId, playerName }) => {
      setPendingRequests(prev => [...prev, { requestId, playerName }]);
    });

    // ── Disconnect / reconnect ────────────────────────────────────────────
    socket.on('disconnect', reason => {
      const inSession = gameDataRef.current || roomDataRef.current || spectDataRef.current;
      // 'io client disconnect' = saída voluntária (leave_room), não reconectar
      if (reason === 'io client disconnect') {
        if (!inSession) navigate('/', { replace: true });
        return;
      }
      if (inSession) {
        setIsReconnecting(true);
        // 35s = tempo suficiente para Socket.IO reconectar (backoff 0.5→2s) + margem
        reconnTimerRef.current = setTimeout(() => {
          clearAll();
          navigate('/', { replace: true });
        }, 35_000);
      } else {
        navigate('/', { replace: true });
      }
    });

    // Quando socket reconecta, reseta o timer de desistência (servidor enviará game_state logo)
    socket.on('connect', () => {
      if (reconnTimerRef.current) {
        clearTimeout(reconnTimerRef.current);
        // Dá 8s para o servidor confirmar a sessão antes de desistir
        reconnTimerRef.current = setTimeout(() => {
          clearAll();
          navigate('/', { replace: true });
        }, 8_000);
      }
    });

    socket.on('session_expired', () => {
      clearTimeout(reconnTimerRef.current);
      clearAll();
      navigate('/', { replace: true });
    });

    return () => {
      socket.off('room_updated');
      socket.off('game_state');
      socket.off('spectator_joined');
      socket.off('spectator_state');
      socket.off('join_approved');
      socket.off('join_request');
      socket.off('disconnect');
      socket.off('connect');
      socket.off('session_expired');
    };
  }, [navigate]);

  function clearAll() {
    setIsReconnecting(false);
    setRoomData(null);
    setGameData(null);
    setMyPlayerId(null);
    setPendingRequests([]);
    setIsSpectator(false);
    setSpectatorData(null);
  }

  function handleApprove(requestId) {
    socket.emit('approve_join', { requestId }, res => {
      if (res?.success) setPendingRequests(prev => prev.filter(r => r.requestId !== requestId));
    });
  }

  function handleDeny(requestId) {
    socket.emit('deny_join', { requestId }, res => {
      if (res?.success) setPendingRequests(prev => prev.filter(r => r.requestId !== requestId));
    });
  }

  function handleRoomCreated(room) {
    setMyPlayerId(socket.id);
    setRoomData(room);
    navigate(`/sala/${room.code}`);
  }

  const handleLeave = useCallback(() => {
    socket.emit('leave_room', {}, () => {
      clearAll();
      navigate('/');
    });
  }, [navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Forçar orientação landscape em mobile ─────────────────────────────────
  useEffect(() => {
    screen.orientation?.lock?.('landscape-primary').catch(() => {});
  }, []);

  // ── Kick por inatividade (5 min sem nenhum clique/toque/tecla) ────────────
  useEffect(() => {
    let lastActivity = Date.now();
    const resetTimer = () => { lastActivity = Date.now(); };

    document.addEventListener('click',      resetTimer);
    document.addEventListener('touchstart', resetTimer, { passive: true });
    document.addEventListener('keydown',    resetTimer);

    const interval = setInterval(() => {
      // Só age se o jogador estiver dentro de uma sala ou partida
      if (!roomDataRef.current && !gameDataRef.current) return;
      if (Date.now() - lastActivity > 5 * 60 * 1000) {
        handleLeave();
      }
    }, 30_000);

    return () => {
      document.removeEventListener('click',      resetTimer);
      document.removeEventListener('touchstart', resetTimer);
      document.removeEventListener('keydown',    resetTimer);
      clearInterval(interval);
    };
  }, [handleLeave]);

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
      <p style={{ color: '#fff', fontSize: 18, fontWeight: 600, margin: 0 }}>Reconectando…</p>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: 0 }}>Aguenta aí, você vai voltar pra partida</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

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
              isSpectator={isSpectator}
              spectatorData={spectatorData}
              onApprove={handleApprove}
              onDeny={handleDeny}
              onLeave={handleLeave}
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
