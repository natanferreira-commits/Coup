import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactDOM from 'react-dom';
import styles from './EventPopup.module.css';

// ── Meta por tipo de evento ───────────────────────────────────────────────────
const EVENT_META = {
  operacao_pf:     { emoji: '🚔', color: '#2196f3', bg: '#06122a', glow: '#2196f3' },
  fake_news:       { emoji: '📰', color: '#ce93d8', bg: '#12062a', glow: '#9c27b0' },
  jogo_do_bicho:   { emoji: '🎲', color: '#ffb74d', bg: '#1a0e00', glow: '#e65100' },
  mensalao:        { emoji: '💵', color: '#69f0ae', bg: '#061a0a', glow: '#4caf50' },
  arrastaoo:       { emoji: '💸', color: '#ef9a9a', bg: '#1a0606', glow: '#f44336' },
  crise_economica: { emoji: '📉', color: '#ffcc02', bg: '#161200', glow: '#ff9800' },
  no_event:        { emoji: '😴', color: 'rgba(255,255,255,0.35)', bg: '#080808', glow: 'rgba(255,255,255,0.08)' },
};

const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

// ── Componente de dado por jogador (Jogo do Bicho) ────────────────────────────
function DiceCard({ result, rolling, revealed, revealDelay }) {
  const [face, setFace] = useState(0);

  useEffect(() => {
    if (!rolling || revealed) return;
    const id = setInterval(() => setFace(f => (f + 1) % 6), 110);
    return () => clearInterval(id);
  }, [rolling, revealed]);

  const delta = result.coinDelta;
  const color = delta > 0 ? '#69f0ae' : delta < 0 ? '#ef9a9a' : result.key === 'skip' ? '#ffd600' : '#aaa';

  return (
    <motion.div
      className={styles.diceCard}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={revealed ? { opacity: 1, scale: 1 } : { opacity: rolling ? 1 : 0.5, scale: rolling ? 1 : 0.85 }}
      transition={{ delay: revealed ? revealDelay : 0, type: 'spring', stiffness: 340, damping: 22 }}
    >
      <span className={styles.dicePlayerName}>{result.playerName}</span>

      <div className={styles.diceIcon}>
        {revealed ? (
          <motion.span
            initial={{ scale: 0.4, rotate: -20, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ delay: revealDelay, type: 'spring', stiffness: 400, damping: 18 }}
          >
            {DICE_FACES[Math.abs(result.coinDelta * 2 + (result.key === 'skip' ? 5 : 2)) % 6]}
          </motion.span>
        ) : (
          <span className={rolling ? styles.diceSpinning : styles.diceIdle}>
            {DICE_FACES[face]}
          </span>
        )}
      </div>

      <motion.span
        className={styles.diceResult}
        style={{ color }}
        animate={revealed ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
        transition={{ delay: revealed ? revealDelay + 0.1 : 0, duration: 0.35 }}
      >
        {revealed ? result.label : '...'}
      </motion.span>
    </motion.div>
  );
}

// ── Popup principal ───────────────────────────────────────────────────────────
export default function EventPopup({ event, onDismiss }) {
  // rollPhase: 'idle' | 'rolling' | 'revealed'
  const [rollPhase, setRollPhase] = useState('idle');

  // onDismiss é estável (useCallback no Game.jsx) — sem risco de reset de timer
  const dismiss = useCallback(() => { onDismiss?.(); }, [onDismiss]);

  // ── Reset de fase ao trocar de evento ──────────────────────────────────────
  useEffect(() => {
    if (!event) return;
    setRollPhase('idle');
  }, [event?.eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Timers de auto-dismiss por tipo ───────────────────────────────────────
  useEffect(() => {
    if (!event) return;

    if (event.type === 'no_event') {
      // Sem evento: fecha rápido em 2s
      const t = setTimeout(dismiss, 2000);
      return () => clearTimeout(t);
    }

    if (event.type === 'jogo_do_bicho') {
      // Jogo do Bicho: dismiss gerenciado pelo efeito de rollPhase abaixo
      return;
    }

    // Demais eventos: auto-dismiss em 5s
    const t = setTimeout(dismiss, 5000);
    return () => clearTimeout(t);
  }, [event?.eventId, dismiss]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Jogo do Bicho: rolling → revealed após 2s ─────────────────────────────
  useEffect(() => {
    if (event?.type !== 'jogo_do_bicho' || rollPhase !== 'rolling') return;
    const t = setTimeout(() => setRollPhase('revealed'), 2000);
    return () => clearTimeout(t);
  }, [event?.type, rollPhase]);

  // ── Jogo do Bicho: auto-dismiss 5s após revealed ──────────────────────────
  useEffect(() => {
    if (event?.type !== 'jogo_do_bicho' || rollPhase !== 'revealed') return;
    const t = setTimeout(dismiss, 5000);
    return () => clearTimeout(t);
  }, [event?.type, rollPhase, dismiss]);

  if (!event) return null;

  const meta      = EVENT_META[event.type] || { emoji: '⚡', color: '#fff', bg: '#111', glow: '#fff' };
  const isBicho   = event.type === 'jogo_do_bicho';
  const isNoEvent = event.type === 'no_event';

  // Duração da barra de countdown
  const timerDuration = isNoEvent ? 2 : 5;
  // Key garante que a barra recome quando o bicho chega em 'revealed'
  const timerKey = isBicho && rollPhase === 'revealed'
    ? `${event.eventId}-revealed`
    : `${event.eventId}`;

  const showTimer = !isBicho || rollPhase === 'revealed';

  return ReactDOM.createPortal(
    <AnimatePresence>
      <motion.div
        className={`${styles.overlay}${isNoEvent ? ` ${styles.overlayNoEvent}` : ''}`}
        style={{ '--ev-color': meta.color, '--ev-glow': meta.glow, '--ev-bg': meta.bg }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={dismiss}
      >
        <div className={styles.bg} />
        <div className={styles.scanlines} />

        <motion.div
          className={`${styles.card}${isNoEvent ? ` ${styles.cardNoEvent}` : ''}`}
          initial={{ scale: 0.72, y: 50, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.88, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 22 }}
          onClick={e => e.stopPropagation()}
        >
          {/* Emoji animado */}
          <motion.div
            className={styles.emoji}
            animate={isNoEvent
              ? { scale: 1, rotate: 0 }
              : { scale: [1, 1.12, 1], rotate: [0, -4, 4, 0] }
            }
            transition={{ repeat: isNoEvent ? 0 : Infinity, duration: 2.5, ease: 'easeInOut' }}
          >
            {meta.emoji}
          </motion.div>

          {/* Label + título */}
          {!isNoEvent && <div className={styles.label}>EVENTO DA RODADA</div>}
          <h2 className={`${styles.title}${isNoEvent ? ` ${styles.titleNoEvent}` : ''}`}>
            {event.name}
          </h2>
          {!isNoEvent && <p className={styles.description}>{event.description}</p>}

          {/* ── Jogo do Bicho: botão Girar (idle) ── */}
          {isBicho && rollPhase === 'idle' && (
            <motion.button
              className={styles.rollBtn}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 300, damping: 18 }}
              whileHover={{ scale: 1.06, y: -2 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => setRollPhase('rolling')}
            >
              🎲 Girar os Dados!
            </motion.button>
          )}

          {/* ── Jogo do Bicho: grade de dados (rolling ou revealed) ── */}
          {isBicho && rollPhase !== 'idle' && event.results?.length > 0 && (
            <>
              {rollPhase === 'rolling' && (
                <p className={styles.rollingHint}>🎲 Rolando os dados...</p>
              )}
              {rollPhase === 'revealed' && (
                <p className={styles.rollingHint} style={{ color: '#ffb74d' }}>
                  🏆 Resultados!
                </p>
              )}
              <div className={styles.diceGrid}>
                {event.results.map((r, i) => (
                  <DiceCard
                    key={r.playerId}
                    result={r}
                    rolling={rollPhase === 'rolling'}
                    revealed={rollPhase === 'revealed'}
                    revealDelay={i * 0.35}
                  />
                ))}
              </div>
            </>
          )}

          {/* ── Barra de countdown ── */}
          {showTimer && (
            <div className={styles.timerBar}>
              <motion.div
                key={timerKey}
                className={styles.timerFill}
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: timerDuration, ease: 'linear' }}
              />
            </div>
          )}

          <div className={styles.skipHint}>
            {isBicho && rollPhase === 'idle' ? 'CLIQUE NO BOTÃO PARA GIRAR' : 'CLIQUE PARA FECHAR'}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
