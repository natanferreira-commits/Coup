import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './GameLog.module.css';

// Classify log entry for color coding
function getEntryColor(text) {
  if (!text) return null;
  if (text.includes('DUVIDOU') || text.includes('duvidou') || text.includes('VAR')) return '#ef9a9a'; // challenge = red
  if (text.includes('bloqueou') || text.includes('🛡️')) return '#82b1ff'; // block = blue
  if (text.includes('perdeu') || text.includes('eliminado') || text.includes('💀') || text.includes('⚰️')) return '#ff8a65'; // death = orange
  if (text.includes('venceu') || text.includes('🏆')) return '#ffd600'; // win = gold
  if (text.includes('moeda') || text.includes('taxou') || text.includes('trampo') || text.includes('💵') || text.includes('💸')) return '#69f0ae'; // coins = green
  if (text.includes('ROUND') || text.includes('━━━')) return 'rgba(255,214,0,0.55)'; // round separator = gold
  if (text.includes('Vez de')) return 'rgba(255,255,255,0.3)'; // turn = muted
  return null;
}

export default function GameLog({ log }) {
  const ref = useRef(null);

  useEffect(() => {
    // Scroll imediato + depois da animação (Framer Motion anima height: 0→auto)
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
    const t = setTimeout(() => {
      if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
    }, 280);
    return () => clearTimeout(t);
  }, [log]);

  return (
    <div className={styles.log} ref={ref}>
      <AnimatePresence initial={false}>
        {log?.map((entry, i) => {
          const color = getEntryColor(entry);
          const isLast = i === (log.length - 1);
          return (
            <motion.p
              key={entry + i}
              className={styles.entry}
              style={{ color: isLast ? (color || 'rgba(255,255,255,0.95)') : (color || 'rgba(255,255,255,0.6)') }}
              initial={{ opacity: 0, x: -8, height: 0 }}
              animate={{ opacity: 1, x: 0, height: 'auto' }}
              transition={{ duration: 0.22 }}>
              {entry}
            </motion.p>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
