import { useEffect, useRef } from 'react';
import styles from './GameLog.module.css';

export default function GameLog({ log }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [log]);

  return (
    <div className={styles.log} ref={ref}>
      {log?.map((entry, i) => (
        <p key={i} className={styles.entry}>{entry}</p>
      ))}
    </div>
  );
}
