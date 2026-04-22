import { motion, AnimatePresence } from 'framer-motion';
import ReactDOM from 'react-dom';

/**
 * CardDeathAnimation — efeito de queima quando carta é eliminada
 * Props:
 *   queue: Array<{ id, x, y }>  — centro da carta eliminada
 */
export default function CardDeathAnimation({ queue }) {
  return ReactDOM.createPortal(
    <AnimatePresence>
      {queue.map(anim => (
        <DeathBurst key={anim.id} x={anim.x} y={anim.y} />
      ))}
    </AnimatePresence>,
    document.body
  );
}

const SPARKS = ['💀', '🔥', '✨', '💥', '🔥'];

function DeathBurst({ x, y }) {
  return (
    <>
      {/* Radial fire glow */}
      <motion.div
        style={{
          position: 'fixed',
          left: x - 50,
          top: y - 65,
          width: 100,
          height: 130,
          pointerEvents: 'none',
          zIndex: 9990,
          borderRadius: 10,
          background: 'radial-gradient(ellipse at 50% 60%, rgba(255,60,0,0.85) 0%, rgba(255,100,0,0.4) 45%, transparent 75%)',
          mixBlendMode: 'screen',
        }}
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: [0, 1, 0.6, 0], scale: [0.4, 1.2, 1.5, 2] }}
        exit={{}}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      />
      {/* Emoji sparks */}
      {SPARKS.map((emoji, i) => {
        const angle = (i / SPARKS.length) * Math.PI * 2 - Math.PI / 2;
        const dist = 40 + Math.random() * 25;
        return (
          <motion.div
            key={i}
            style={{
              position: 'fixed',
              left: x,
              top: y,
              pointerEvents: 'none',
              zIndex: 9991,
              fontSize: '1.3rem',
              marginLeft: -10,
              marginTop: -10,
              userSelect: 'none',
            }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 0.8 }}
            animate={{
              x: Math.cos(angle) * dist,
              y: Math.sin(angle) * dist - 20,
              opacity: [1, 1, 0],
              scale: [0.8, 1.3, 0.5],
            }}
            exit={{}}
            transition={{ duration: 0.65, delay: i * 0.05, ease: 'easeOut' }}
          >
            {emoji}
          </motion.div>
        );
      })}
    </>
  );
}
