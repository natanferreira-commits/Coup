import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactDOM from 'react-dom';
import styles from './EventPopup.module.css';

// ── Meta visual por tipo de evento ───────────────────────────────────────────
const EVENT_META = {
  operacao_pf:     { emoji: '🚔', color: '#2196f3', bg: '#06122a', glow: '#2196f3' },
  fake_news:       { emoji: '📰', color: '#ce93d8', bg: '#12062a', glow: '#9c27b0' },
  jogo_do_bicho:   { emoji: '🎲', color: '#ffb74d', bg: '#1a0e00', glow: '#e65100' },
  mensalao:        { emoji: '💵', color: '#69f0ae', bg: '#061a0a', glow: '#4caf50' },
  arrastaoo:       { emoji: '💸', color: '#ef9a9a', bg: '#1a0606', glow: '#f44336' },
  crise_economica: { emoji: '📉', color: '#ffcc02', bg: '#161200', glow: '#ff9800' },
};

const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

// ── DiceCard por jogador (Jogo do Bicho) ─────────────────────────────────────
function DiceCard({ result, rolling, revealed, revealDelay }) {
  const [face, setFace] = useState(0);

  useEffect(() => {
    if (!rolling || revealed) return;
    const id = setInterval(() => setFace(f => (f + 1) % 6), 110);
    return () => clearInterval(id);
  }, [rolling, revealed]);

  const delta = result.coinDelta;
  const color = delta > 0 ? '#69f0ae' : delta < 0 ? '#ef9a9a' : result.key === 'skip' ? '#ffd600' : '#aaa';

  // Face do dado baseada no resultado (determinística para não piscalar no reveal)
  const revealedFace = DICE_FACES[Math.abs((result.coinDelta * 2 + (result.key === 'skip' ? 5 : 2) + result.playerName.length) % 6)];

  return (
    <motion.div
      className={styles.diceCard}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={revealed
        ? { opacity: 1, scale: 1 }
        : { opacity: rolling ? 1 : 0.5, scale: rolling ? 1 : 0.85 }
      }
      transition={{ delay: revealed ? revealDelay : 0, type: 'spring', stiffness: 340, damping: 22 }}
    >
      <span className={styles.dicePlayerName}>{result.playerName}</span>

      <div className={styles.diceIcon}>
        {revealed ? (
          <motion.span
            key="revealed"
            initial={{ scale: 0.4, rotate: -20, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ delay: revealDelay, type: 'spring', stiffness: 420, damping: 18 }}
          >
            {revealedFace}
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
  // rollPhase: 'idle' | 'rolling' | 'revealed'  (Jogo do Bicho)
  const [rollPhase, setRollPhase] = useState('idle');

  // onDismiss vem estabilizado via useCallback no Game.jsx
  const dismiss = useCallback(() => { onDismiss?.(); }, [onDismiss]);

  // ── Reset de fase ao trocar de evento ──────────────────────────────────────
  useEffect(() => {
    if (!event) return;
    setRollPhase('idle');
  }, [event?.eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-dismiss para eventos que não precisam de interação ──────────────
  useEffect(() => {
    if (!event) return;
    if (event.type === 'jogo_do_bicho') return; // gerenciado pelos efeitos abaixo

    // Todos os outros eventos: auto-dismiss em 5s
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

  const meta    = EVENT_META[event.type] || { emoji: '⚡', color: '#fff', bg: '#111', glow: '#fff' };
  const isBicho = event.type === 'jogo_do_bicho';

  // Chave da barra: reinicia quando bicho chega em 'revealed'
  const timerKey = isBicho && rollPhase === 'revealed'
    ? `${event.eventId}-revealed`
    : `${event.eventId}`;

  const showTimer = !isBicho || rollPhase === 'revealed';

  return ReactDOM.createPortal(
    <AnimatePresence>
      <motion.div
        className={styles.overlay}
        style={{ '--ev-color': meta.color, '--ev-glow': meta.glow, '--ev-bg': meta.bg }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={dismiss}
      >
        <div className={styles.bg} />
        <div className={styles.scanlines} />

        <motion.div
          className={styles.card}
          initial={{ scale: 0.72, y: 50, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.88, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 22 }}
          onClick={e => e.stopPropagation()}
        >
          {/* Emoji animado */}
          <motion.div
            className={styles.emoji}
            animate={{ scale: [1, 1.12, 1], rotate: [0, -4, 4, 0] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
          >
            {meta.emoji}
          </motion.div>

          {/* Cabeçalho */}
          <div className={styles.label}>EVENTO DO ROUND</div>
          <h2 className={styles.title}>{event.name}</h2>
          <p className={styles.description}>{event.description}</p>

          {/* ── Jogo do Bicho: botão Girar (fase idle) ── */}
          {isBicho && rollPhase === 'idle' && (
            <motion.button
              className={styles.rollBtn}
              initial={{ scale: 0.88, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 300, damping: 18 }}
              whileHover={{ scale: 1.06, y: -2 }}
              whileTap={{ scale: 0.93 }}
              onClick={() => setRollPhase('rolling')}
            >
              🎲 Girar os Dados!
            </motion.button>
          )}

          {/* ── Jogo do Bicho: grade de dados (rolling ou revealed) ── */}
          {isBicho && rollPhase !== 'idle' && event.results?.length > 0 && (
            <>
              <p className={styles.rollingHint} style={rollPhase === 'revealed' ? { color: '#ffb74d' } : {}}>
                {rollPhase === 'rolling' ? '🎲 Rolando os dados...' : '🏆 Resultados!'}
              </p>
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
                transition={{ duration: 5, ease: 'linear' }}
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
