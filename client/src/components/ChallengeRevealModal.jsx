import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactDOM from 'react-dom';
import { CHAR_CONFIG } from './charConfig';
import { sfx } from '../sounds/sfx';
import styles from './ChallengeRevealModal.module.css';

const DRUM_ROLL_MS  = 1900;  // drum roll duration
const HOLD_MS       = 1400;  // hold on reveal before dismiss
const TOTAL_MS      = DRUM_ROLL_MS + HOLD_MS;

/**
 * ChallengeRevealModal
 *
 * Props:
 *   reveal: {
 *     actorName:    string  — who was challenged
 *     claimedChar:  string  — what character was claimed
 *     won:          bool    — true = actor had the card (challenger loses); false = bluff caught
 *   } | null
 *   onDismiss: () => void
 */
export default function ChallengeRevealModal({ reveal, onDismiss }) {
  const [phase, setPhase] = useState('roll'); // 'roll' | 'reveal'

  useEffect(() => {
    if (!reveal) return;
    setPhase('roll');
    sfx.drumRoll();

    const t1 = setTimeout(() => {
      setPhase('reveal');
      sfx.revealStab(reveal.won);
    }, DRUM_ROLL_MS);

    const t2 = setTimeout(() => {
      onDismiss?.();
    }, TOTAL_MS);

    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [reveal]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!reveal) return null;

  const cfg = CHAR_CONFIG[reveal.claimedChar] || {};

  return ReactDOM.createPortal(
    <AnimatePresence>
      <motion.div
        className={styles.overlay}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onDismiss}
      >
        {/* Dark bg */}
        <div className={styles.bg} />
        <div className={styles.scanlines} />

        <div className={styles.content}>
          {/* Drum roll phase */}
          <AnimatePresence mode="wait">
            {phase === 'roll' && (
              <motion.div key="roll" className={styles.rollPhase}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                <motion.div
                  className={styles.questionMark}
                  animate={{ scale: [1, 1.08, 1], rotate: [-3, 3, -3] }}
                  transition={{ repeat: Infinity, duration: 0.28 }}
                >
                  🃏
                </motion.div>
                <p className={styles.rollLabel}>VERIFICANDO…</p>
                <p className={styles.rollSub}>
                  <strong>{reveal.actorName}</strong> afirmou ser{' '}
                  {cfg.icon} <strong>{cfg.label}</strong>
                </p>
                {/* Progress bar */}
                <div className={styles.rollBar}>
                  <motion.div
                    className={styles.rollBarFill}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: DRUM_ROLL_MS / 1000, ease: 'linear' }}
                  />
                </div>
              </motion.div>
            )}

            {phase === 'reveal' && (
              <motion.div key="reveal" className={styles.revealPhase}
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}>

                {/* Card art */}
                {cfg.img ? (
                  <motion.div className={styles.cardWrap}
                    style={{ '--char-color': cfg.color || '#ffd600' }}
                    initial={{ rotateY: 90 }}
                    animate={{ rotateY: 0 }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}>
                    <img src={cfg.img} alt={cfg.label} className={styles.cardImg} />
                    <div className={styles.cardGlow} />
                  </motion.div>
                ) : (
                  <motion.div className={styles.charEmoji}
                    initial={{ scale: 0.2, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 16 }}>
                    {cfg.icon || '🃏'}
                  </motion.div>
                )}

                {/* Result */}
                <motion.div
                  className={`${styles.resultBadge} ${reveal.won ? styles.resultWon : styles.resultLost}`}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.15 }}>
                  {reveal.won ? '✅ TINHA MESMO!' : '❌ BLEFE FLAGRADO!'}
                </motion.div>

                <motion.p className={styles.resultSub}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
                  {reveal.won
                    ? <><strong>{reveal.actorName}</strong> provou ter {cfg.icon} <strong>{cfg.label}</strong>. O duvidador perde uma carta.</>
                    : <><strong>{reveal.actorName}</strong> não tinha {cfg.icon} <strong>{cfg.label}</strong>. Blefe revelado!</>
                  }
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
