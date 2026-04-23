import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactDOM from 'react-dom';
import { sfx } from '../sounds/sfx';
import styles from './SettingsPanel.module.css';

export default function SettingsPanel({ open, onClose, onLeave }) {
  const [sfxVol, setSfxVol]   = useState(() => sfx.getVolume('sfx'));
  const [musicVol, setMusicVol] = useState(() => sfx.getVolume('music'));

  const handleSfx = v => {
    setSfxVol(v);
    sfx.setVolume('sfx', v);
  };

  const handleMusic = v => {
    setMusicVol(v);
    sfx.setVolume('music', v);
  };

  return ReactDOM.createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className={styles.overlay}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}>
          <motion.div className={styles.panel}
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            onClick={e => e.stopPropagation()}>

            <div className={styles.header}>
              <h2 className={styles.title}>⚙️ Configurações</h2>
              <button className={styles.closeBtn} onClick={onClose}>✕</button>
            </div>

            <div className={styles.section}>
              <label className={styles.label}>🔊 Efeitos Sonoros</label>
              <div className={styles.sliderRow}>
                <span className={styles.volIcon}>{sfxVol === 0 ? '🔇' : '🔉'}</span>
                <input type="range" min={0} max={1} step={0.01}
                  value={sfxVol} onChange={e => handleSfx(Number(e.target.value))}
                  className={styles.slider} />
                <span className={styles.volNum}>{Math.round(sfxVol * 100)}%</span>
              </div>
            </div>

            <div className={styles.section}>
              <label className={styles.label}>🎵 Música Ambiente</label>
              <div className={styles.sliderRow}>
                <span className={styles.volIcon}>{musicVol === 0 ? '🔇' : '🎵'}</span>
                <input type="range" min={0} max={1} step={0.01}
                  value={musicVol} onChange={e => handleMusic(Number(e.target.value))}
                  className={styles.slider} />
                <span className={styles.volNum}>{Math.round(musicVol * 100)}%</span>
              </div>
            </div>

            <div className={styles.divider} />

            <motion.button className={styles.leaveBtn}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={onLeave}>
              🚪 Sair da Partida
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
