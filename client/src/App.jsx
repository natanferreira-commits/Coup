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
  const [isReconnecting,       setIsReconnecting]       = useState(false);
  const [showInactiveWarning,  setShowInactiveWarning]  = useState(false);
  const [inactiveCountdown,    setInactiveCountdown]    = useState(30);

  // Spectator state
  const [isSpectator,   setIsSpectator]   = useState(false);
  const [spectatorData, setSpectatorData] = useState(null); // { code, game, queuePosition }

  const gameDataRef        = useRef(gameData);
  const roomDataRef        = useRef(roomData);
  const spectDataRef       = useRef(spectatorData);
  const reconnTimerRef     = useRef(null);
  const inactiveWarningRef = useRef(false);  // true while the warning modal is visible
  const inactiveTimerRef   = useRef(null);   // holds the 30-s countdown interval

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

  // ── Inatividade: aviso 30 s antes de chutar (5 min sem interação) ─────────
  useEffect(() => {
    let lastActivity = Date.now();

    // Qualquer interação do usuário reseta o timer e dispensa o aviso
    const resetActivity = () => {
      lastActivity = Date.now();
      if (inactiveWarningRef.current) {
        inactiveWarningRef.current = false;
        setShowInactiveWarning(false);
        setInactiveCountdown(30);
        if (inactiveTimerRef.current) {
          clearInterval(inactiveTimerRef.current);
          inactiveTimerRef.current = null;
        }
      }
    };

    document.addEventListener('click',      resetActivity);
    document.addEventListener('touchstart', resetActivity, { passive: true });
    document.addEventListener('keydown',    resetActivity);
    document.addEventListener('mousemove',  resetActivity);

    // Verifica a cada 10 s se 5 min de inatividade foram atingidos
    const checkInterval = setInterval(() => {
      if (!roomDataRef.current && !gameDataRef.current) return;
      if (inactiveWarningRef.current) return; // countdown já em andamento
      if (Date.now() - lastActivity >= 5 * 60 * 1000) {
        // Mostra aviso e inicia contagem regressiva de 30 s
        inactiveWarningRef.current = true;
        setShowInactiveWarning(true);
        setInactiveCountdown(30);

        let count = 30;
        inactiveTimerRef.current = setInterval(() => {
          count -= 1;
          setInactiveCountdown(count);
          if (count <= 0) {
            clearInterval(inactiveTimerRef.current);
            inactiveTimerRef.current = null;
            inactiveWarningRef.current = false;
            setShowInactiveWarning(false);
            handleLeave();
          }
        }, 1_000);
      }
    }, 10_000);

    return () => {
      document.removeEventListener('click',      resetActivity);
      document.removeEventListener('touchstart', resetActivity);
      document.removeEventListener('keydown',    resetActivity);
      document.removeEventListener('mousemove',  resetActivity);
      clearInterval(checkInterval);
      if (inactiveTimerRef.current) clearInterval(inactiveTimerRef.current);
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

  // ── Overlay de inatividade ────────────────────────────────────────────────
  const inactiveOverlay = showInactiveWarning && (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9998,
      background: 'rgba(0,0,0,0.72)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 20, backdropFilter: 'blur(6px)',
    }}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '36px 32px',
        maxWidth: 340,
        width: '90%',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
      }}>
        {/* Countdown ring */}
        <div style={{ position: 'relative', width: 72, height: 72 }}>
          <svg width="72" height="72" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
            <circle
              cx="36" cy="36" r="30" fill="none"
              stroke={inactiveCountdown <= 10 ? '#ef5350' : '#ffd600'}
              strokeWidth="5"
              strokeDasharray={`${2 * Math.PI * 30}`}
              strokeDashoffset={`${2 * Math.PI * 30 * (1 - inactiveCountdown / 30)}`}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.3s' }}
            />
          </svg>
          <span style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.4rem', fontWeight: 700,
            color: inactiveCountdown <= 10 ? '#ef5350' : '#fff',
          }}>{inactiveCountdown}</span>
        </div>

        <p style={{ fontSize: '1.35rem', fontWeight: 700, color: '#fff', margin: 0 }}>
          Você ainda está aí? 👋
        </p>
        <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.55)', margin: 0 }}>
          Você ficou inativo por 5 minutos.<br />
          Confirme presença ou será removido da sala.
        </p>

        <button
          onClick={() => {
            // resetActivity will fire via the click event listener on document;
            // but we also call it directly to be immediate
            inactiveWarningRef.current = false;
            setShowInactiveWarning(false);
            setInactiveCountdown(30);
            if (inactiveTimerRef.current) {
              clearInterval(inactiveTimerRef.current);
              inactiveTimerRef.current = null;
            }
          }}
          style={{
            background: '#ffd600', color: '#000',
            border: 'none', borderRadius: 50,
            padding: '12px 32px',
            fontSize: '0.95rem', fontWeight: 700,
            cursor: 'pointer',
            width: '100%',
          }}
        >
          ✋ Sim, estou aqui!
        </button>
      </div>
    </div>
  );

  return (
    <>
      {reconnOverlay}
      {inactiveOverlay}
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
