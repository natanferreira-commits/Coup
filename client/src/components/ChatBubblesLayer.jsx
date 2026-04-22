import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * ChatBubblesLayer — renderiza todos os chat bubbles como fixed overlay
 * Evita problemas de overflow clipping dos containers do jogo.
 *
 * Props:
 *   bubbles    : { [playerId]: { message, key } }
 *   getPos     : (playerId) => { x: number, y: number }  — centro top do elemento
 */
export default function ChatBubblesLayer({ bubbles, getPos }) {
  const entries = Object.entries(bubbles);
  if (entries.length === 0) return null;

  return ReactDOM.createPortal(
    <AnimatePresence>
      {entries.map(([playerId, bubble]) => {
        const pos = getPos(playerId);
        return (
          <motion.div
            key={bubble.key}
            style={{
              position: 'fixed',
              left: pos.x,
              top: pos.y - 10,
              transform: 'translate(-50%, -100%)',
              background: bubble.mine ? 'rgba(41,121,255,0.96)' : 'rgba(255,255,255,0.97)',
              color: bubble.mine ? '#fff' : '#111',
              borderRadius: 14,
              padding: '6px 13px',
              fontSize: '0.76rem',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              maxWidth: 180,
              textAlign: 'center',
              boxShadow: '0 3px 16px rgba(0,0,0,0.45)',
              pointerEvents: 'none',
              zIndex: 9900,
              userSelect: 'none',
            }}
            initial={{ opacity: 0, y: 10, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.85 }}
            transition={{ type: 'spring', stiffness: 420, damping: 24 }}
          >
            {bubble.message}
            {/* Triangle pointer */}
            <div style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0, height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: bubble.mine
                ? '7px solid rgba(41,121,255,0.96)'
                : '7px solid rgba(255,255,255,0.97)',
            }} />
          </motion.div>
        );
      })}
    </AnimatePresence>,
    document.body
  );
}
