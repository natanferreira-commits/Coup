import { motion, AnimatePresence } from 'framer-motion';
import ReactDOM from 'react-dom';

/**
 * ChallengeAnimation — raio + flash quando alguém desafia
 * Props:
 *   active: boolean
 */
export default function ChallengeAnimation({ active }) {
  return ReactDOM.createPortal(
    <AnimatePresence>
      {active && (
        <motion.div
          key="challenge-anim"
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 8700,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1, 0] }}
          exit={{}}
          transition={{ duration: 0.9, times: [0, 0.08, 0.65, 1] }}
        >
          {/* Full-screen flash */}
          <motion.div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(ellipse at 50% 40%, rgba(255,230,0,0.22) 0%, rgba(255,100,0,0.08) 50%, transparent 75%)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.4, 0] }}
            transition={{ duration: 0.75 }}
          />

          {/* Lightning bolt */}
          <motion.div
            style={{
              fontSize: '7rem',
              lineHeight: 1,
              position: 'relative',
              zIndex: 1,
              filter: 'drop-shadow(0 0 30px rgba(255,200,0,0.9))',
            }}
            initial={{ scale: 0.2, rotate: -25, opacity: 0 }}
            animate={{
              scale: [0.2, 1.8, 1.4, 1.6, 0],
              rotate: [-25, 8, -5, 0, 0],
              opacity: [0, 1, 1, 1, 0],
            }}
            transition={{ duration: 0.8, times: [0, 0.25, 0.45, 0.65, 1], ease: 'backOut' }}
          >
            ⚡
          </motion.div>

          {/* VAR text */}
          <motion.div
            style={{
              position: 'absolute',
              top: '54%',
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: '2rem',
              letterSpacing: '0.3em',
              color: 'rgba(255,220,0,0.9)',
              textShadow: '0 0 20px rgba(255,200,0,0.8)',
            }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: [0, 1, 1, 0], y: [10, 0, 0, -5] }}
            transition={{ duration: 0.8, times: [0, 0.2, 0.7, 1] }}
          >
            VAR! ⚽
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
