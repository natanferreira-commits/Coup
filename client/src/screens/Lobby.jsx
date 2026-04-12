import { useState } from 'react';
import socket from '../socket';
import styles from './Lobby.module.css';

export default function Lobby({ onJoined }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function connect(cb) {
    if (!name.trim()) return setError('Digite seu nome');
    setError('');
    setLoading(true);

    if (socket.connected) {
      cb();
      return;
    }

    socket.connect();

    function onConnect() { cleanup(); cb(); }
    function onError() { cleanup(); setLoading(false); setError('Servidor offline. Rode o servidor primeiro (npm run dev na pasta /server).'); }

    function cleanup() {
      socket.off('connect', onConnect);
      socket.off('connect_error', onError);
    }

    socket.once('connect', onConnect);
    socket.once('connect_error', onError);
  }

  function handleCreate() {
    connect(() => {
      socket.emit('create_room', { playerName: name.trim() }, res => {
        setLoading(false);
        if (res.success) onJoined(res.room, name.trim());
        else setError(res.error || 'Erro ao criar sala');
      });
    });
  }

  function handleJoin() {
    if (!code.trim()) return setError('Digite o código da sala');
    connect(() => {
      socket.emit('join_room', { code: code.trim().toUpperCase(), playerName: name.trim() }, res => {
        setLoading(false);
        if (res.success) onJoined(res.room, name.trim());
        else setError(res.error || 'Erro ao entrar na sala');
      });
    });
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>GOLPE</h1>
        <p className={styles.subtitle}>Blefe. Poder. Traição.</p>

        <div className={styles.form}>
          <input
            placeholder="Seu nome"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={20}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />

          <button className="btn btn-primary" onClick={handleCreate} disabled={loading}>
            {loading ? 'Conectando...' : 'Criar Sala'}
          </button>

          <div className={styles.divider}><span>ou entre em uma sala</span></div>

          <input
            placeholder="Código da sala (ex: AB3K)"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            maxLength={4}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
          />

          <button className="btn" onClick={handleJoin} disabled={loading}>
            Entrar na Sala
          </button>

          {error && <p className={styles.error}>{error}</p>}
        </div>
      </div>
    </div>
  );
}
