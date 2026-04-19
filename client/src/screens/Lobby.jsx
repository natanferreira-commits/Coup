import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../socket';
import styles from './Lobby.module.css';

export default function Lobby({ onCreated }) {
  const navigate  = useNavigate();
  const [name,    setName]    = useState(() => localStorage.getItem('golpe_name') || '');
  const [code,    setCode]    = useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('Conectando...');

  function connect(cb) {
    if (!name.trim()) return setError('Digite seu nome');
    setError('');
    setLoading(true);
    setLoadingMsg('Conectando...');

    if (socket.connected) { cb(); return; }

    socket.connect();

    const warmupTimer = setTimeout(() => {
      setLoadingMsg('Servidor acordando, aguarde (~30s)...');
    }, 4000);

    function onConnect()   { cleanup(); cb(); }
    function onError()     {
      cleanup();
      setLoading(false);
      const isLocalhost = (import.meta.env.VITE_SERVER_URL || '').includes('localhost');
      setError(isLocalhost
        ? 'Servidor offline. Rode o servidor (npm run dev na pasta /server).'
        : 'Não foi possível conectar. Tente novamente em alguns segundos.'
      );
    }
    function cleanup() {
      clearTimeout(warmupTimer);
      socket.off('connect',       onConnect);
      socket.off('connect_error', onError);
    }

    socket.once('connect',       onConnect);
    socket.once('connect_error', onError);
  }

  function handleCreate() {
    connect(() => {
      localStorage.setItem('golpe_name', name.trim());
      socket.emit('create_room', { playerName: name.trim() }, res => {
        setLoading(false);
        if (res.success) {
          onCreated(res.room, name.trim());
        } else {
          setError(res.error || 'Erro ao criar sala');
        }
      });
    });
  }

  function handleJoin() {
    if (!code.trim()) return setError('Digite o código da sala');
    if (!name.trim()) return setError('Digite seu nome');
    localStorage.setItem('golpe_name', name.trim());
    // Navigate to the room — SalaPage will handle the join-request flow
    navigate(`/sala/${code.trim().toUpperCase()}`, { state: { playerName: name.trim() } });
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
            {loading ? loadingMsg : 'Criar Sala'}
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
