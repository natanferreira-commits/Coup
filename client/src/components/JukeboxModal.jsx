import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import socket from '../socket';
import { MUSIC_TRACKS } from '../sounds/sfx';
import styles from './JukeboxModal.module.css';

const THREE_MIN = 3 * 60 * 1000;

function formatSeconds(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function JukeboxModal({ onClose, musicTrack, musicLastChanged, myCoins, activeEvent }) {
  // How many ms of cooldown remain right now
  const [remaining, setRemaining] = useState(() => {
    const elapsed = Date.now() - (musicLastChanged || 0);
    return Math.max(0, THREE_MIN - elapsed);
  });

  // Track the user is about to pay a coin for
  const [pendingPayTrack, setPendingPayTrack] = useState(null);
  const [loading, setLoading]                 = useState(false);
  const [feedback, setFeedback]               = useState('');   // success / error msg

  const intervalRef = useRef(null);

  // Live countdown ticker
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - (musicLastChanged || 0);
      const rem = Math.max(0, THREE_MIN - elapsed);
      setRemaining(rem);
      if (rem === 0) clearInterval(intervalRef.current);
    }, 500);
    return () => clearInterval(intervalRef.current);
  }, [musicLastChanged]);

  // Escape key
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const inCooldown = remaining > 0;

  function requestChange(trackId, payCoins = false) {
    setLoading(true);
    setFeedback('');
    socket.emit('change_music', { trackId, payCoins }, res => {
      setLoading(false);
      if (!res) return;
      if (res.success) {
        setPendingPayTrack(null);
        setFeedback('');
        onClose();
      } else if (res.error === 'cooldown') {
        // Show cooldown info (shouldn't happen if UI is correct, but just in case)
        setFeedback(`Aguarda ${formatSeconds(res.remaining * 1000)}`);
      } else {
        setFeedback(res.error || 'Erro ao trocar música');
      }
    });
  }

  function handleTrackClick(trackId) {
    if (loading) return;
    if (trackId === musicTrack) { onClose(); return; }
    if (!inCooldown) {
      requestChange(trackId);
    } else {
      setPendingPayTrack(trackId);
    }
  }

  function handlePayCoin() {
    if (!pendingPayTrack) return;
    requestChange(pendingPayTrack, true);
  }

  const cooldownPct = Math.min(1, remaining / THREE_MIN);

  return (
    <AnimatePresence>
      <motion.div
        className={styles.overlay}
        key="jukebox-modal"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className={styles.modal}
          initial={{ opacity: 0, y: 16, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.96 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className={styles.header}>
            <span className={styles.title}>🎵 Jukebox</span>
            <button className={styles.closeBtn} onClick={onClose}>✕</button>
          </div>

          {/* Big Fone banner */}
          {activeEvent?.type === 'big_fone' && (
            <div className={styles.bigFoneBanner} style={activeEvent.bigFoneClaimed ? { opacity: 0.5 } : {}}>
              <span className={styles.bigFoneEmoji}>📞</span>
              <span className={styles.bigFoneText}>
                {activeEvent.bigFoneClaimed
                  ? 'Big Fone já foi atendido neste round.'
                  : <><strong>BIG FONE!</strong> Toque uma música agora e ganhe +2 moedas!</>}
              </span>
            </div>
          )}

          {/* Cooldown bar */}
          {inCooldown && (
            <div className={styles.cooldownRow}>
              <div className={styles.cooldownBar}>
                <div className={styles.cooldownFill} style={{ width: `${(1 - cooldownPct) * 100}%` }} />
              </div>
              <span className={styles.cooldownTime}>{formatSeconds(remaining)}</span>
            </div>
          )}

          {/* Track list */}
          <div className={styles.list}>
            {MUSIC_TRACKS.map(track => {
              const active = musicTrack === track.id || (!musicTrack && track.id === 'none');
              const isPending = pendingPayTrack === track.id;
              return (
                <motion.button
                  key={track.id}
                  className={`${styles.trackBtn} ${active ? styles.trackActive : ''} ${isPending ? styles.trackPending : ''}`}
                  onClick={() => handleTrackClick(track.id)}
                  whileHover={{ x: 3 }}
                  whileTap={{ scale: 0.97 }}
                  disabled={loading}
                >
                  <span className={styles.trackEmoji}>{track.emoji}</span>
                  <span className={styles.trackLabel}>{track.label}</span>
                  {active && track.id !== 'none' && !isPending && (
                    <motion.span
                      className={styles.playingDot}
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ repeat: Infinity, duration: 1.1 }}
                    >▶</motion.span>
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Pay coin confirmation */}
          <AnimatePresence>
            {pendingPayTrack && (
              <motion.div
                className={styles.payCoinBox}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
              >
                <p className={styles.payCoinText}>
                  Cooldown ativo ({formatSeconds(remaining)}).<br />
                  Pagar <strong>1 💰</strong> para trocar agora?
                </p>
                <div className={styles.payCoinBtns}>
                  <button
                    className={styles.payCoinYes}
                    onClick={handlePayCoin}
                    disabled={loading || myCoins < 1}
                  >
                    {myCoins < 1 ? 'Sem moedas' : loading ? '...' : '✓ Pagar 1 💰'}
                  </button>
                  <button
                    className={styles.payCoinNo}
                    onClick={() => setPendingPayTrack(null)}
                    disabled={loading}
                  >
                    Cancelar
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {feedback && <p className={styles.feedback}>{feedback}</p>}

          {!inCooldown && !pendingPayTrack && (
            <p className={styles.hint}>Todos na partida ouvirão a mesma música</p>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
