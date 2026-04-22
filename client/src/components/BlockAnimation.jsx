import { motion, AnimatePresence } from 'framer-motion';
import ReactDOM from 'react-dom';

/**
 * BlockAnimation — escudo se expandindo quando ação é bloqueada
 * Props:
 *   active: boolean
 */
export default function BlockAnimation({ active }) {
  return ReactDOM.createPortal(
    <AnimatePresence>
      {active && (
        <motion.div
          key="block-anim"
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 8600,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Ripple rings */}
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              style={{
                position: 'absolute',
                width: 80,
                height: 80,
                borderRadius: '50%',
                border: `${3 - i}px solid rgba(100,180,255,${0.7 - i * 0.2})`,
              }}
              initial={{ scale: 0.5, opacity: 1 }}
              animate={{ scale: 4 + i * 1.5, opacity: 0 }}
              transition={{ duration: 0.7 + i * 0.15, delay: i * 0.1, ease: 'easeOut' }}
            />
          ))}

          {/* Shield icon */}
          <motion.div
            style={{ fontSize: '5rem', lineHeight: 1, position: 'relative', zIndex: 1 }}
            initial={{ scale: 0.2, opacity: 0, rotate: -15 }}
            animate={{
              scale: [0.2, 1.5, 1.15, 1.3, 0],
              opacity: [0, 1, 1, 1, 0],
              rotate: [-15, 5, -3, 0, 0],
            }}
            transition={{ duration: 0.85, ease: 'backOut', times: [0, 0.3, 0.5, 0.7, 1] }}
          >
            🛡️
          </motion.div>

          {/* Background flash */}
          <motion.div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(ellipse at 50% 50%, rgba(100,160,255,0.12) 0%, transparent 65%)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 0.6 }}
          />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
