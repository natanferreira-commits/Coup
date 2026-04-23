import { motion, AnimatePresence } from 'framer-motion';
import ReactDOM from 'react-dom';
import { CHAR_CONFIG } from './charConfig';
import styles from './ChallengeWonModal.module.css';

export default function ChallengeWonModal({ pa, iAmActor, actorName, onSwap, onKeep }) {
  const show = pa && (pa.challengeWonCharacter || pa.challengeWonCardIdx !== undefined);
  if (!show) return null;

  const cfg = CHAR_CONFIG[pa.challengeWonCharacter] || {};

  return ReactDOM.createPortal(
    <AnimatePresence>
      {show && (
        <motion.div className={styles.overlay}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}>
          <motion.div className={styles.card}
            initial={{ scale: 0.82, y: 40 }} animate={{ scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 22 }}>

            {/* Header */}
            <div className={styles.header}>
              <motion.div className={styles.checkBadge}
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.1 }}>
                ✅
              </motion.div>
              <div>
                <h2 className={styles.title}>DUVIDADA FALHOU!</h2>
                <p className={styles.subtitle}>
                  <strong style={{ color: '#82b1ff' }}>{actorName}</strong> provou ter{' '}
                  <strong style={{ color: cfg.color || 'var(--yellow)' }}>
                    {cfg.icon} {cfg.label}
                  </strong>
                </p>
              </div>
            </div>

            {/* Card art */}
            {cfg.img && (
              <motion.div className={styles.cardArt}
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 }}>
                <img src={cfg.img} alt={cfg.label} className={styles.charImg} />
                <div className={styles.charGlow} style={{ background: `radial-gradient(ellipse, ${cfg.color}44, transparent 70%)` }} />
              </motion.div>
            )}

            {/* Choice */}
            {iAmActor ? (
              <>
                <p className={styles.choiceLabel}>
                  Sua carta foi revelada para todos. O que deseja fazer?
                </p>
                <div className={styles.btnRow}>
                  <motion.button className={styles.btnSwap}
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}
                    onClick={onSwap}>
                    <span className={styles.btnIcon}>🔄</span>
                    <div>
                      <strong>Trocar pelo Baralho</strong>
                      <small>Pegar uma carta nova (escondida)</small>
                    </div>
                  </motion.button>
                  <motion.button className={styles.btnKeep}
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}
                    onClick={onKeep}>
                    <span className={styles.btnIcon}>✊</span>
                    <div>
                      <strong>Manter a Carta</strong>
                      <small>Continuar com {cfg.label}</small>
                    </div>
                  </motion.button>
                </div>
              </>
            ) : (
              <motion.p className={styles.waitingText}
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ repeat: Infinity, duration: 1.4 }}>
                ⌛ <strong>{actorName}</strong> está decidindo se troca a carta...
              </motion.p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
