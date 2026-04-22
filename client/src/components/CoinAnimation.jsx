import { motion, AnimatePresence } from 'framer-motion';
import ReactDOM from 'react-dom';

/**
 * CoinAnimation — moedas voando entre jogadores / banco
 * Props:
 *   queue: Array<{ id, from: {x,y}, to: {x,y}, amount }>
 */
export default function CoinAnimation({ queue }) {
  return ReactDOM.createPortal(
    <AnimatePresence>
      {queue.map(anim => (
        <CoinBurst key={anim.id} anim={anim} />
      ))}
    </AnimatePresence>,
    document.body
  );
}

function CoinBurst({ anim }) {
  const count = Math.min(Math.max(anim.amount, 1), 6);
  const dx = anim.to.x - anim.from.x;
  const dy = anim.to.y - anim.from.y;

  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const spread = (i - (count - 1) / 2) * 16;
        const arcY = -60 - Math.random() * 40;   // arc upward mid-flight
        const delay = i * 0.06;

        return (
          <motion.div
            key={i}
            style={{
              position: 'fixed',
              left: anim.from.x,
              top: anim.from.y,
              pointerEvents: 'none',
              zIndex: 9999,
              fontSize: '1.15rem',
              marginLeft: -10,
              marginTop: -10,
              userSelect: 'none',
              filter: 'drop-shadow(0 2px 4px rgba(255,200,0,0.7))',
            }}
            initial={{ x: spread * 0.3, y: 0, opacity: 0, scale: 0.6 }}
            animate={{
              x: [spread * 0.3, spread * 0.5 + dx * 0.5, dx + spread],
              y: [0, arcY, dy],
              opacity: [0, 1, 1, 0],
              scale: [0.6, 1.2, 1, 0.5],
            }}
            exit={{}}
            transition={{
              duration: 0.75,
              delay,
              ease: 'easeInOut',
              opacity: { times: [0, 0.15, 0.75, 1] },
            }}
          >
            💰
          </motion.div>
        );
      })}
    </>
  );
}
