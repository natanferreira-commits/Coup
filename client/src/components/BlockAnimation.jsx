import { motion, AnimatePresence } from 'framer-motion';
import ReactDOM from 'react-dom';

const CHAR_STYLES = {
  juiz:          { color: '#66bb6a', icon: '⚖️', label: 'JUIZ BLOQUEOU!',     bg: '#0a2a0a' },
  guarda_costas: { color: '#42a5f5', icon: '🪖', label: 'MILICIANO BLOQUEOU!', bg: '#040f1f' },
  politico:      { color: '#82b1ff', icon: '🏛️', label: 'POLÍTICO BLOQUEOU!', bg: '#080820' },
  default:       { color: '#90caf9', icon: '🛡️', label: 'BLOQUEADO!',         bg: '#040a14' },
};

export default function BlockAnimation({ active, blockerCharacter }) {
  const s = CHAR_STYLES[blockerCharacter] || CHAR_STYLES.default;

  return ReactDOM.createPortal(
    <AnimatePresence>
      {active && (
        <motion.div
          key="block-anim"
          style={{
            position: 'fixed', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none', zIndex: 8600,
            background: `radial-gradient(ellipse at 50% 50%, ${s.bg}ee 0%, transparent 70%)`,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}>

          {/* Ripple rings — character color */}
          {[0, 1, 2, 3].map(i => (
            <motion.div key={i} style={{
              position: 'absolute',
              width: 100, height: 100,
              borderRadius: '50%',
              border: `${3 - Math.min(i, 2)}px solid ${s.color}`,
              opacity: 0.7 - i * 0.12,
            }}
            initial={{ scale: 0.5, opacity: 0.7 - i * 0.12 }}
            animate={{ scale: 5 + i * 2, opacity: 0 }}
            transition={{ duration: 1.2 + i * 0.2, delay: i * 0.12, ease: 'easeOut' }} />
          ))}

          {/* Shield icon — big */}
          <motion.div style={{ fontSize: '7rem', lineHeight: 1, filter: `drop-shadow(0 0 30px ${s.color})` }}
            initial={{ scale: 0.1, opacity: 0, rotate: -20 }}
            animate={{ scale: [0.1, 1.6, 1.3, 1.45, 0], opacity: [0, 1, 1, 1, 0], rotate: [-20, 5, -3, 0, 0] }}
            transition={{ duration: 2.4, ease: 'backOut', times: [0, 0.22, 0.45, 0.7, 1] }}>
            {s.icon}
          </motion.div>

          {/* BLOQUEADO text */}
          <motion.div style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
            letterSpacing: '0.15em',
            color: s.color,
            textShadow: `0 0 40px ${s.color}, 2px 2px 0 rgba(0,0,0,0.8)`,
            marginTop: 8,
          }}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: [20, 0, 0, 0], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 2.4, times: [0, 0.18, 0.7, 1] }}>
            {s.label}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
