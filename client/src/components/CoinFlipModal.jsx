import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { useEffect, useRef } from 'react';
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
  const coinControls = useAnimation();
  const lastResultRef = useRef(null);
  const currentAngleRef = useRef(0);

  // Fast spinning when waiting for result
  useEffect(() => {
    if (phase !== 'COIN_FLIP') { coinControls.stop(); return; }
    if (!pa?.coinFlipResult) {
      // Spin fast and continuously
      (async function spin() {
        while (true) {
          try {
            currentAngleRef.current += 360;
            await coinControls.start({
              rotateY: currentAngleRef.current,
              transition: { duration: 0.22, ease: 'linear' },
            });
          } catch { break; }
        }
      })();
    }
  }, [phase, pa?.coinFlipResult]);  // eslint-disable-line

  // When result arrives: decelerate to correct face
  useEffect(() => {
    const result = pa?.coinFlipResult;
    if (!result || result === lastResultRef.current) return;
    lastResultRef.current = result;
    coinControls.stop();
    // Round up to a multiple of 360, then add extra for the result face
    const base = Math.ceil(currentAngleRef.current / 360) * 360;
    // cara = front face (0 mod 360), coroa = back face (180 mod 360)
    const extra = result === 'cara' ? 360 * 3 : 360 * 3 + 180;
    const finalAngle = base + extra;
    currentAngleRef.current = finalAngle;
    coinControls.start({
      rotateY: finalAngle,
      transition: { duration: 3.5, ease: [0.15, 0, 0.05, 1] },
    });
  }, [pa?.coinFlipResult]);  // eslint-disable-line

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
            <strong style={{ color: '#82b1ff' }}>{blockerName}</strong> gastou 1 moeda para bloquear{' '}
            <strong style={{ color: '#ef9a9a' }}>{actorName}</strong>
            <br />
            <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>
              🦅 Cara → bloqueio vale, moeda volta · 🐉 Coroa → bloqueio falha, perde a moeda
            </span>
          </p>

          {/* ── The Coin ── */}
          <div className={styles.coinWrapper}>
            <motion.div
              className={styles.coinFlipInner}
              animate={coinControls}
              style={{ transformStyle: 'preserve-3d' }}>

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
            </motion.div>

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
                  ? `✅ CARA! Bloqueio aprovado — ${blockerName} defendeu e recupera a moeda.`
                  : `❌ COROA! Bloqueio falhou — ${blockerName} perde a moeda e ${actorName} rouba de ${targetName}.`
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
