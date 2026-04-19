import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import socket from '../socket';
import Room from './Room';
import Game from './Game';
import SpectatorView from './SpectatorView';
import styles from './SalaPage.module.css';

/**
 * Handles everything that happens at /sala/:code:
 *  - If already in the room/game (App.jsx state) → render Room or Game directly
 *  - Otherwise → show the join-request flow (name input → waiting for host approval → denied)
 */
export default function SalaPage({ roomData, gameData, myPlayerId, pendingRequests, isSpectator, spectatorData, onApprove, onDeny, onLeave }) {
  const { code }   = useParams();
  const location   = useLocation();

  // Pre-fill name from navigation state (Lobby passes it) or localStorage
  const [name, setName]           = useState(() =>
    location.state?.playerName || localStorage.getItem('golpe_name') || ''
  );
  const [phase, setPhase]         = useState('idle'); // idle | connecting | requesting | denied
  const [error, setError]         = useState('');
  const [deniedReason, setDenied] = useState('');

  // Listen for denial (only relevant while requesting)
  useEffect(() => {
    function onDenied({ reason }) {
      setPhase('denied');
      setDenied(reason || 'Host negou sua entrada');
    }
    socket.on('join_denied', onDenied);
    return () => socket.off('join_denied', onDenied);
  }, []);

  // ── Already in room/game/spectating? ─────────────────────────────────────
  if (isSpectator && spectatorData) {
    return <SpectatorView spectatorData={spectatorData} onLeave={onLeave} />;
  }

  if (gameData) {
    return <Game data={gameData} myId={myPlayerId || socket.id} />;
  }

  if (roomData && roomData.code === code) {
    return (
      <Room
        room={roomData}
        myPlayerId={myPlayerId}
        pendingRequests={pendingRequests}
        onApprove={onApprove}
        onDeny={onDeny}
        onLeave={onLeave}
      />
    );
  }

  // ── Join request flow ─────────────────────────────────────────────────────
  function handleRequest() {
    const trimmed = name.trim();
    if (!trimmed) return setError('Digite seu nome');
    setError('');
    localStorage.setItem('golpe_name', trimmed);
    setPhase('connecting');

    const doRequest = () => {
      setPhase('requesting');
      socket.emit('request_join', { code, playerName: trimmed }, res => {
        if (!res?.success) {
          setPhase('idle');
          setError(res?.error || 'Erro ao solicitar entrada');
          return;
        }
        // status === 'pending' → waiting for host
        // status === 'joined'  → host bypass (hostPid match) — join_approved will come
      });
    };

    if (socket.connected) {
      doRequest();
    } else {
      socket.connect();
      socket.once('connect', doRequest);
      socket.once('connect_error', () => {
        setPhase('idle');
        setError('Não foi possível conectar. Tente novamente.');
      });
    }
  }

  return (
    <div className={styles.container}>
      <AnimatePresence mode="wait">

        {/* ── Requesting ── */}
        {phase === 'requesting' && (
          <motion.div key="requesting" className={styles.card}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className={styles.roomCode}>{code}</div>
            <div className={styles.spinner} />
            <p className={styles.message}>Aguardando aprovação do host…</p>
            <p className={styles.sub}>O dono da sala precisa te aceitar</p>
            <button className="btn" onClick={() => { setPhase('idle'); socket.off('join_denied'); }}>
              Cancelar
            </button>
          </motion.div>
        )}

        {/* ── Denied ── */}
        {phase === 'denied' && (
          <motion.div key="denied" className={styles.card}
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <div className={styles.roomCode}>{code}</div>
            <p className={styles.deniedIcon}>🚫</p>
            <p className={styles.deniedMsg}>{deniedReason}</p>
            <button className="btn" onClick={() => setPhase('idle')} style={{ marginTop: 8 }}>
              Tentar novamente
            </button>
          </motion.div>
        )}

        {/* ── Idle — name input ── */}
        {phase === 'idle' && (
          <motion.div key="idle" className={styles.card}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <h2 className={styles.title}>GOLPE</h2>
            <p className={styles.codeLabel}>
              Entrando na sala <span className={styles.codeHighlight}>{code}</span>
            </p>
            <div className={styles.form}>
              <input
                placeholder="Seu nome"
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={20}
                onKeyDown={e => e.key === 'Enter' && handleRequest()}
                autoFocus
              />
              <button className="btn btn-primary" onClick={handleRequest}>
                Solicitar Entrada
              </button>
              {error && <p className={styles.error}>{error}</p>}
            </div>
          </motion.div>
        )}

        {/* ── Connecting ── */}
        {phase === 'connecting' && (
          <motion.div key="connecting" className={styles.card}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className={styles.spinner} />
            <p className={styles.message}>Conectando…</p>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
