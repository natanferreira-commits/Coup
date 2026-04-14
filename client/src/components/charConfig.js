import milicianoImg from '../assets/cards/miliciano.svg';
import bicheiroImg  from '../assets/cards/bicheiro.svg';
import politicoImg  from '../assets/cards/politico.svg';

export const CHAR_CONFIG = {
  politico:      { label: 'Político',  color: '#1565c0', icon: '🏛️', desc: '+3 moedas (Faz o L)',      img: politicoImg  },
  empresario:    { label: 'Bicheiro',  color: '#e65100', icon: '💼', desc: 'Rouba 2 (Pegar o Arrego)', img: bicheiroImg  },
  investigador:  { label: 'X9',        color: '#6a1b9a', icon: '🕵️', desc: 'Investiga, Disfarce, Troca', img: null       },
  juiz:          { label: 'Juiz',      color: '#1b5e20', icon: '⚖️', desc: 'Bloqueia roubo e X9',      img: null         },
  assassino:     { label: 'Miliciano', color: '#b71c1c', icon: '🔪', desc: 'Manda pro Vasco (3 moedas)',img: milicianoImg },
  guarda_costas: { label: 'Segurança', color: '#4e342e', icon: '🛡️', desc: 'Bloqueia Miliciano/Bicheiro', img: null      },
};
