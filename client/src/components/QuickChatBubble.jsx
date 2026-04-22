import { motion } from 'framer-motion';

/**
 * QuickChatBubble — bolha de zoeira sobre o card do jogador
 * Props:
 *   message: string
 *   mine: boolean   — true se for o próprio jogador
 */
export default function QuickChatBubble({ message, mine = false }) {
  return (
    <motion.div
      style={{
        position: 'absolute',
        bottom: mine ? 'auto' : 'calc(100% + 8px)',
        top: mine ? 'calc(100% + 8px)' : 'auto',
        left: '50%',
        translateX: '-50%',
        background: mine ? 'rgba(41,121,255,0.96)' : 'rgba(255,255,255,0.97)',
        color: mine ? '#fff' : '#111',
        borderRadius: 14,
        padding: '5px 11px',
        fontSize: '0.74rem',
        fontWeight: 700,
        whiteSpace: 'nowrap',
        boxShadow: '0 3px 14px rgba(0,0,0,0.4)',
        pointerEvents: 'none',
        zIndex: 50,
        maxWidth: 160,
        textAlign: 'center',
      }}
      initial={{ opacity: 0, y: mine ? -6 : 6, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: mine ? 4 : -4, scale: 0.88 }}
      transition={{ type: 'spring', stiffness: 420, damping: 24 }}
    >
      {message}
      {/* Triangle pointer */}
      <div
        style={{
          position: 'absolute',
          [mine ? 'bottom' : 'top']: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 0,
          height: 0,
          borderLeft: '6px solid transparent',
          borderRight: '6px solid transparent',
          [mine ? 'borderBottom' : 'borderTop']: `7px solid ${mine ? 'rgba(41,121,255,0.96)' : 'rgba(255,255,255,0.97)'}`,
        }}
      />
    </motion.div>
  );
}
