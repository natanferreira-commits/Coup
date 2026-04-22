import { motion, AnimatePresence } from 'framer-motion';
import ReactDOM from 'react-dom';
import styles from './CoinFlipModal.module.css';

/**
 * CoinFlipModal — janela centralizada da moeda de 1 Real
 *
 * Props:
 *   phase           : string
 *   pa              : pendingAction object
 *   blockerName     : string | null
 *   actorName       : string | null
 *   targetName      : string | null
 *   iAmBlocker      : boolean
 *   iAmActor        : boolean
 *   coinAnimating   : boolean   (true → spinning, false → showing result)
 *   onFlip          : () => void
 */
export default function CoinFlipModal({
  phase, pa, blockerName, actorName, targetName,
  iAmBlocker, iAmActor, coinAnimating, onFlip,
}) {
  if (phase !== 'COIN_FLIP') return null;

  const result = pa?.coinFlipResult;    // null | 'cara' | 'coroa'
  const cara   = result === 'cara';
  const coroa  = result === 'coroa';

  return ReactDOM.createPortal(
    <AnimatePresence>
      <motion.div
        className={styles.overlay}
        key="coin-flip-modal"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <motion.div
          className={styles.card}
          initial={{ scale: 0.85, y: 30 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.85, y: 30 }}
          transition={{ type: 'spring', stiffness: 320, damping: 24 }}
        >
          <h2 className={styles.title}>🪙 CARA OU COROA</h2>
          <p className={styles.subtitle}>
            <strong style={{ color: '#82b1ff' }}>{blockerName}</strong> bloqueou a ação de{' '}
            <strong style={{ color: '#ef9a9a' }}>{actorName}</strong>
          </p>

          {/* ── The Coin ── */}
          <div className={styles.coinWrapper}>
            <div className={`${styles.coinFlipInner} ${(!result || coinAnimating) ? styles.spinning : ''}`}
              style={
                result && !coinAnimating
                  ? { transform: `rotateY(${cara ? '0deg' : '180deg'})`, transition: 'transform 0.6s ease-out' }
                  : {}
              }>

              {/* CARA (front face) */}
              <div className={`${styles.coinFace} ${styles.coinFront}`}>
                <span className={styles.coinR}>R$</span>
                <span className={styles.coinText}>1<br />REAL</span>
                <span className={styles.coinText} style={{ fontSize: '0.48rem', opacity: 0.6 }}>BRASIL</span>
              </div>

              {/* COROA (back face) */}
              <div className={`${styles.coinFace} ${styles.coinBack}`}>
                <span className={styles.coinR} style={{ fontSize: '2.4rem' }}>👑</span>
                <span className={styles.coinText}>COROA</span>
              </div>
            </div>

            {/* Result glow */}
            {result && !coinAnimating && (
              <div className={`${styles.resultGlow} ${cara ? styles.resultGlowCara : styles.resultGlowCoroa}`} />
            )}
          </div>

          {/* ── Status messages ── */}
          {!result && (
            iAmBlocker ? (
              <motion.button
                className={styles.flipBtn}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                onClick={onFlip}
              >
                🪙 Jogar a Moeda
              </motion.button>
            ) : (
              <p className={styles.waiting}>
                ⌛ Aguardando <strong>{blockerName}</strong> jogar a moeda...
              </p>
            )
          )}

          {result && coinAnimating && (
            <p className={styles.waiting}>🌀 A moeda está girando...</p>
          )}

          {result && !coinAnimating && (
            <>
              <motion.div
                className={`${styles.resultLabel} ${cara ? styles.resultLabelCara : styles.resultLabelCoroa}`}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 18 }}>
                {cara ? '🦅 CARA!' : '🐉 COROA!'}
              </motion.div>
              <p className={styles.resultDesc}>
                {cara
                  ? `✅ Bloqueio aprovado! ${blockerName} defende e recupera a moeda.`
                  : `❌ Bloqueio falhou! ${actorName} rouba de ${targetName}.`
                }
              </p>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
