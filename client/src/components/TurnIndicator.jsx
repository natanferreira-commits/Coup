import { motion, AnimatePresence } from 'framer-motion';
import ReactDOM from 'react-dom';

/**
 * TurnIndicator — banner 🔥 VEZ DE [NOME] que aparece quando o turno muda
 * Props:
 *   playerName: string | null
 *   isMe: boolean
 *   visible: boolean
 */
export default function TurnIndicator({ playerName, isMe, visible }) {
  if (!playerName) return null;

  return ReactDOM.createPortal(
    <AnimatePresence>
      {visible && (
        <motion.div
          key={playerName + '-turn'}
          style={{
            position: 'fixed',
            top: 0,
            left: '50%',
            translateX: '-50%',
            pointerEvents: 'none',
            zIndex: 8200,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
          initial={{ y: -70, opacity: 0, scale: 0.85 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -70, opacity: 0, scale: 0.85 }}
          transition={{ type: 'spring', stiffness: 450, damping: 28 }}
        >
          <div
            style={{
              background: isMe
                ? 'linear-gradient(135deg, #ffd600 0%, #ff9800 100%)'
                : 'rgba(14, 14, 22, 0.96)',
              color: isMe ? '#000' : '#fff',
              border: isMe ? 'none' : '1px solid rgba(255,255,255,0.12)',
              borderRadius: '0 0 16px 16px',
              padding: '6px 28px 8px',
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: '1.15rem',
              letterSpacing: '0.1em',
              whiteSpace: 'nowrap',
              boxShadow: isMe
                ? '0 4px 24px rgba(255,214,0,0.4)'
                : '0 4px 20px rgba(0,0,0,0.6)',
            }}
          >
            {isMe ? '🔥 SUA VEZ!' : `🔥 VEZ DE ${playerName.toUpperCase()}`}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
