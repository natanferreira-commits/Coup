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

const SPARKS = ['💀', '🔥', '💥', '✨', '🔥', '💀', '💥', '🔥'];

function DeathBurst({ x, y }) {
  return (
    <>
      {/* Outer shockwave ring */}
      <motion.div
        style={{
          position: 'fixed',
          left: x - 60,
          top: y - 60,
          width: 120,
          height: 120,
          pointerEvents: 'none',
          zIndex: 9988,
          borderRadius: '50%',
          border: '3px solid rgba(255,60,0,0.7)',
        }}
        initial={{ opacity: 0.9, scale: 0.1 }}
        animate={{ opacity: 0, scale: 2.8 }}
        exit={{}}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />

      {/* Main fire glow — large */}
      <motion.div
        style={{
          position: 'fixed',
          left: x - 70,
          top: y - 90,
          width: 140,
          height: 180,
          pointerEvents: 'none',
          zIndex: 9989,
          borderRadius: '50% 50% 40% 40%',
          background: 'radial-gradient(ellipse at 50% 65%, rgba(255,80,0,0.9) 0%, rgba(255,160,0,0.5) 40%, rgba(255,60,0,0.2) 65%, transparent 80%)',
          mixBlendMode: 'screen',
        }}
        initial={{ opacity: 0, scale: 0.3, y: 0 }}
        animate={{ opacity: [0, 1, 0.8, 0], scale: [0.3, 1.3, 1.6, 2], y: [-10, -30, -50] }}
        exit={{}}
        transition={{ duration: 0.85, ease: 'easeOut' }}
      />

      {/* Secondary glow — white-hot core */}
      <motion.div
        style={{
          position: 'fixed',
          left: x - 30,
          top: y - 35,
          width: 60,
          height: 70,
          pointerEvents: 'none',
          zIndex: 9990,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(255,255,200,0.95) 0%, rgba(255,120,0,0.5) 55%, transparent 80%)',
          mixBlendMode: 'screen',
        }}
        initial={{ opacity: 0, scale: 0.2 }}
        animate={{ opacity: [0, 1, 0], scale: [0.2, 1.1, 0.4] }}
        exit={{}}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      />

      {/* Card silhouette flying upward */}
      <motion.div
        style={{
          position: 'fixed',
          left: x - 18,
          top: y - 28,
          width: 36,
          height: 52,
          pointerEvents: 'none',
          zIndex: 9991,
          borderRadius: 5,
          background: 'linear-gradient(160deg, #1351b4 0%, #0a3880 100%)',
          border: '1.5px solid rgba(255,255,255,0.2)',
          boxShadow: '0 0 12px rgba(255,100,0,0.6)',
        }}
        initial={{ opacity: 1, y: 0, rotateZ: 0, rotateY: 0 }}
        animate={{ opacity: [1, 0.8, 0], y: -90, rotateZ: [0, -25, -45], rotateY: [0, 90, 180] }}
        exit={{}}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />

      {/* Emoji sparks — more of them, larger, radiate outward */}
      {SPARKS.map((emoji, i) => {
        const angle = (i / SPARKS.length) * Math.PI * 2 - Math.PI / 2;
        const dist = 55 + Math.random() * 35;
        const size = 1.2 + Math.random() * 0.8;
        return (
          <motion.div
            key={i}
            style={{
              position: 'fixed',
              left: x,
              top: y,
              pointerEvents: 'none',
              zIndex: 9992,
              fontSize: `${size}rem`,
              marginLeft: -12,
              marginTop: -12,
              userSelect: 'none',
            }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 0.6 }}
            animate={{
              x: Math.cos(angle) * dist,
              y: Math.sin(angle) * dist - 30,
              opacity: [1, 1, 0],
              scale: [0.6, 1.4, 0.3],
            }}
            exit={{}}
            transition={{ duration: 0.8, delay: i * 0.04, ease: 'easeOut' }}
          >
            {emoji}
          </motion.div>
        );
      })}

      {/* Screen flash */}
      <motion.div
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 9987,
          background: 'rgba(255,80,0,0.12)',
        }}
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        exit={{}}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      />
    </>
  );
}
