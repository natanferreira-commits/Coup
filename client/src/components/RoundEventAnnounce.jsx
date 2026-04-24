import { motion, AnimatePresence } from 'framer-motion';
import ReactDOM from 'react-dom';
import styles from './RoundEventAnnounce.module.css';

/**
 * Overlay fullscreen que aparece por ~2s no início de cada round antes de
 * revelar o evento. Diz "⚡ EVENTO CHEGANDO" com animação de tensão.
 */
export default function RoundEventAnnounce({ active, roundNumber }) {
  return ReactDOM.createPortal(
    <AnimatePresence>
      {active && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.3 } }}
        >
          {/* Fundo escuro com ruído */}
          <div className={styles.bg} />
          <div className={styles.scanlines} />

          <motion.div
            className={styles.content}
            initial={{ scale: 0.82, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 1.06, opacity: 0, transition: { duration: 0.25 } }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          >
            {/* Ícone pulsante */}
            <motion.div
              className={styles.icon}
              animate={{ scale: [1, 1.18, 1], filter: ['brightness(1)', 'brightness(1.6)', 'brightness(1)'] }}
              transition={{ repeat: Infinity, duration: 0.7, ease: 'easeInOut' }}
            >
              ⚡
            </motion.div>

            <div className={styles.roundLabel}>ROUND {roundNumber}</div>

            <motion.div
              className={styles.title}
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ repeat: Infinity, duration: 0.9 }}
            >
              EVENTO CHEGANDO
            </motion.div>

            {/* Dots de loading */}
            <div className={styles.dots}>
              {[0, 1, 2].map(i => (
                <motion.span
                  key={i}
                  className={styles.dot}
                  animate={{ opacity: [0.2, 1, 0.2], y: [0, -5, 0] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.22 }}
                />
              ))}
            </div>

            {/* Barra de progresso 2s */}
            <div className={styles.progressBar}>
              <motion.div
                className={styles.progressFill}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 2, ease: 'linear' }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
