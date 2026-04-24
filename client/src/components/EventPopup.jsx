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
};

const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

// Componente de dado por jogador (Jogo do Bicho)
function DiceCard({ result, revealed }) {
  const [face, setFace] = useState(0);

  // Spinning: cicla rapidamente pelos rostos do dado
  useEffect(() => {
    if (revealed) return;
    const id = setInterval(() => setFace(f => (f + 1) % 6), 120);
    return () => clearInterval(id);
  }, [revealed]);

  const delta = result.coinDelta;
  const color = delta > 0 ? '#69f0ae' : delta < 0 ? '#ef9a9a' : result.key === 'skip' ? '#ffd600' : '#aaa';

  return (
    <div className={styles.diceCard}>
      <span className={styles.dicePlayerName}>{result.playerName}</span>
      <div className={styles.diceIcon}>
        {revealed
          ? <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 18 }}>
              {DICE_FACES[Math.floor(Math.random() * 6)]}
            </motion.span>
          : <span className={styles.diceSpinning}>{DICE_FACES[face]}</span>
        }
      </div>
      <motion.span
        className={styles.diceResult}
        style={{ color }}
        animate={revealed ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
        transition={{ duration: 0.3 }}
      >
        {result.label}
      </motion.span>
    </div>
  );
}

// ── Popup principal ───────────────────────────────────────────────────────────
export default function EventPopup({ event, onDismiss }) {
  const [revealed, setRevealed] = useState(false);

  const dismiss = useCallback(() => { onDismiss?.(); }, [onDismiss]);

  useEffect(() => {
    if (!event) return;
    setRevealed(false);
    // Para Jogo do Bicho: revela resultados após 2 segundos de animação
    const t1 = event.type === 'jogo_do_bicho'
      ? setTimeout(() => setRevealed(true), 2000)
      : null;
    // Auto-dismiss 5 segundos
    const t2 = setTimeout(dismiss, 5000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [event?.eventId, dismiss]);

  if (!event) return null;

  const meta = EVENT_META[event.type] || { emoji: '⚡', color: '#fff', bg: '#111', glow: '#fff' };

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
        {/* Fundo escuro com glow da cor do evento */}
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

          {/* Label + título */}
          <div className={styles.label}>EVENTO DA RODADA</div>
          <h2 className={styles.title}>{event.name}</h2>
          <p className={styles.description}>{event.description}</p>

          {/* Jogo do Bicho — grade de dados por jogador */}
          {event.type === 'jogo_do_bicho' && event.results?.length > 0 && (
            <div className={styles.diceGrid}>
              {event.results.map(r => (
                <DiceCard key={r.playerId} result={r} revealed={revealed} />
              ))}
            </div>
          )}

          {/* Barra de countdown 5s */}
          <div className={styles.timerBar}>
            <motion.div
              className={styles.timerFill}
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: 5, ease: 'linear' }}
            />
          </div>

          <div className={styles.skipHint}>CLIQUE PARA FECHAR</div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
