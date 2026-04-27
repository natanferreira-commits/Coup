import { useEffect, useState } from 'react';
import styles from './ThemeToggle.module.css';

export default function ThemeToggle() {
  const [dark, setDark] = useState(() =>
    localStorage.getItem('golpe_theme') === 'dark'
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('golpe_theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <button
      className={styles.toggle}
      onClick={() => setDark(d => !d)}
      title={dark ? 'Modo claro' : 'Modo escuro'}
      aria-label={dark ? 'Ativar modo claro' : 'Ativar modo escuro'}
    >
      {dark ? '☀️' : '🌙'}
    </button>
  );
}
