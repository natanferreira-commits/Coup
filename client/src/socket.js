import { io } from 'socket.io-client';

function getPid() {
  let pid = localStorage.getItem('golpe_pid');
  if (!pid) {
    pid = crypto.randomUUID();
    localStorage.setItem('golpe_pid', pid);
  }
  return pid;
}

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

const socket = io(SERVER_URL, {
  autoConnect: false,
  auth: { pid: getPid() },
  reconnectionDelay: 500,         // começa tentando mais rápido
  reconnectionDelayMax: 2000,     // limite máximo de espera entre tentativas
  reconnectionAttempts: Infinity, // nunca para de tentar (o client timer controla o timeout)
  timeout: 8000,
});

export default socket;
export { getPid };
