import milicianoImg from '../assets/cards/miliciano.svg';
import bicheiroImg  from '../assets/cards/bicheiro.svg';
import politicoImg  from '../assets/cards/politico.svg';
import juizImg      from '../assets/cards/juiz.svg';
import x9Img        from '../assets/cards/x9.svg';
import bandidoImg   from '../assets/cards/bandido.svg';

export const CHAR_CONFIG = {
  politico:      { label: 'Político',  color: '#1565c0', icon: '🏛️', desc: '+3 moedas (Faz o L)',            img: politicoImg  },
  empresario:    { label: 'Bicheiro',  color: '#e65100', icon: '💼', desc: 'Rouba 2 moedas do alvo',         img: bicheiroImg  },
  investigador:  { label: 'X9',        color: '#6a1b9a', icon: '🕵️', desc: 'Espia · Disfarça · Força troca', img: x9Img        },
  juiz:          { label: 'Juiz',      color: '#1b5e20', icon: '⚖️', desc: 'Bloqueia Bicheiro e X9',         img: juizImg      },
  assassino:     { label: 'Bandido',   color: '#b71c1c', icon: '🔫', desc: 'Elimina carta (3 moedas)',        img: bandidoImg   },
  guarda_costas: { label: 'Segurança', color: '#4e342e', icon: '🛡️', desc: 'Bloqueia Miliciano e Bicheiro',  img: milicianoImg },
};
