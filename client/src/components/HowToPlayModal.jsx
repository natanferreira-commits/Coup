import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './HowToPlayModal.module.css';

/* ── Conteúdo das regras ─────────────────────────────────── */
const CHARS = [
  {
    name: 'Político',
    color: '#1565c0',
    emoji: '🏛️',
    ability: 'Imposto',
    desc: 'Recebe 3 moedas do banco.',
    block: 'Bloqueia Ajuda Externa de qualquer jogador.',
  },
  {
    name: 'Bicheiro',
    color: '#b97916',
    emoji: '🎰',
    ability: 'Extorsão',
    desc: 'Rouba 2 moedas de outro jogador. Se ele tiver só 1, pega só 1.',
    block: null,
    blocked: 'Pode ser bloqueado pelo Bandido.',
  },
  {
    name: 'X9',
    color: '#6a1b9a',
    emoji: '🕵️',
    ability: 'Espionagem',
    desc: 'Espia as cartas de outro jogador e pode forçá-lo a trocar uma (ou nenhuma).',
    block: null,
  },
  {
    name: 'Juiz',
    color: '#1b5e20',
    emoji: '⚖️',
    ability: 'Assassinato',
    desc: 'Paga 3 moedas para eliminar uma influência de outro jogador.',
    block: 'Bloqueia o Assassinato (com custo: perde 1 influência).',
    blocked: 'Pode ser bloqueado pelo próprio Juiz.',
  },
  {
    name: 'Miliciano',
    color: '#b71c1c',
    emoji: '🔫',
    ability: 'Infiltrar',
    desc: 'Troca até 2 cartas suas com o baralho.',
    block: 'Bloqueia o Golpe de Estado (mas não evita o custo de 7 moedas).',
    blocked: null,
  },
  {
    name: 'Bandido',
    color: '#4e342e',
    emoji: '🥷',
    ability: 'Defesa',
    desc: 'Sem ação de ataque direta, mas é imune à Extorsão do Bicheiro.',
    block: 'Bloqueia a Extorsão do Bicheiro.',
  },
];

const ACTIONS = [
  {
    name: 'Renda',
    cost: 0,
    desc: 'Pegue 1 moeda do banco. Não pode ser bloqueada nem desafiada.',
    tag: 'Sempre disponível',
    tagColor: 'green',
  },
  {
    name: 'Ajuda Externa',
    cost: 0,
    desc: 'Pegue 2 moedas do banco. Pode ser bloqueada pelo Político.',
    tag: 'Sempre disponível',
    tagColor: 'green',
  },
  {
    name: 'Golpe de Estado',
    cost: 7,
    desc: 'Pague 7 moedas e elimine 1 influência de qualquer jogador. Não pode ser bloqueado. Com 10+ moedas é obrigatório.',
    tag: 'Sempre disponível',
    tagColor: 'green',
  },
  {
    name: 'Imposto (Político)',
    cost: 0,
    desc: 'Declare ser o Político e pegue 3 moedas.',
    tag: 'Blefe possível',
    tagColor: 'blue',
  },
  {
    name: 'Extorsão (Bicheiro)',
    cost: 0,
    desc: 'Declare ser o Bicheiro e roube 2 moedas de outro jogador.',
    tag: 'Blefe possível',
    tagColor: 'blue',
  },
  {
    name: 'Assassinato (Juiz)',
    cost: 3,
    desc: 'Pague 3 moedas e declare ser o Juiz para eliminar 1 influência. Pode ser bloqueado pelo próprio Juiz.',
    tag: 'Blefe possível',
    tagColor: 'blue',
  },
  {
    name: 'Espionagem (X9)',
    cost: 0,
    desc: 'Declare ser o X9 para ver as cartas de outro jogador e possivelmente forçar uma troca.',
    tag: 'Blefe possível',
    tagColor: 'blue',
  },
  {
    name: 'Infiltrar (Miliciano)',
    cost: 0,
    desc: 'Declare ser o Miliciano para trocar até 2 das suas cartas com o baralho.',
    tag: 'Blefe possível',
    tagColor: 'blue',
  },
];

/* ── Componente ──────────────────────────────────────────── */
export default function HowToPlayModal({ onClose }) {
  // Fechar com Esc
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        className={styles.overlay}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className={styles.modal}
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.97 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className={styles.header}>
            <h2 className={styles.title}>📖 Como Jogar</h2>
            <button className={styles.closeBtn} onClick={onClose}>✕</button>
          </div>

          {/* Scroll body */}
          <div className={styles.body}>

            {/* Objetivo */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>🎯 Objetivo</h3>
              <p className={styles.text}>
                Seja o <strong>último jogador com influência</strong> no jogo.
                Cada jogador começa com <strong>2 cartas de personagem</strong> (suas influências) e{' '}
                <strong>2 moedas</strong>. Perca as 2 cartas e você está eliminado.
              </p>
            </section>

            {/* Início */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>🃏 Como começa</h3>
              <ul className={styles.list}>
                <li>Cada jogador recebe <strong>2 cartas secretas</strong> de personagem e <strong>2 moedas</strong>.</li>
                <li>As cartas ficam <strong>viradas para baixo</strong> — só você vê as suas.</li>
                <li>Os turnos passam em sequência. No seu turno, escolha <strong>1 ação</strong>.</li>
                <li>Você pode <strong>mentir</strong> sobre qual personagem tem — isso é blefar!</li>
              </ul>
            </section>

            {/* Ações Básicas */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>⚡ Ações</h3>
              <div className={styles.actionGrid}>
                {ACTIONS.map(a => (
                  <div key={a.name} className={styles.actionCard}>
                    <div className={styles.actionHeader}>
                      <span className={styles.actionName}>{a.name}</span>
                      {a.cost > 0 && <span className={styles.actionCost}>💰 {a.cost}</span>}
                      <span className={`${styles.actionTag} ${styles[`tag_${a.tagColor}`]}`}>{a.tag}</span>
                    </div>
                    <p className={styles.actionDesc}>{a.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Personagens */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>🎭 Personagens</h3>
              <div className={styles.charGrid}>
                {CHARS.map(c => (
                  <div key={c.name} className={styles.charCard} style={{ borderColor: c.color + '55' }}>
                    <div className={styles.charHeader} style={{ background: c.color + '22' }}>
                      <span className={styles.charEmoji}>{c.emoji}</span>
                      <span className={styles.charName} style={{ color: c.color === '#b97916' ? '#f0c040' : undefined }}>{c.name}</span>
                    </div>
                    <div className={styles.charBody}>
                      <p className={styles.charAbility}>
                        <strong>Ação:</strong> <em>{c.ability}</em> — {c.desc}
                      </p>
                      {c.block && (
                        <p className={styles.charBlock}>
                          <strong>🛡️ Bloqueia:</strong> {c.block}
                        </p>
                      )}
                      {c.blocked && (
                        <p className={styles.charBlocked}>
                          <strong>⚠️ Vulnerável:</strong> {c.blocked}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Blefe e Dúvida */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>🃏 Blefe e Dúvida</h3>
              <p className={styles.text}>
                Qualquer ação ou bloqueio que usa um personagem pode ser <strong>desafiado</strong>.
                Outro jogador pode dizer <em>"Duvido!"</em> antes de você agir.
              </p>
              <ul className={styles.list}>
                <li><strong>Você estava blefando?</strong> Perde 1 influência (vira uma carta).</li>
                <li><strong>Você não estava blefando?</strong> Quem duvidou perde 1 influência. Você devolve a carta ao baralho e pega uma nova.</li>
              </ul>
              <p className={styles.tip}>
                💡 <strong>Dica:</strong> Blefar bem é metade do jogo. Mas desafie na hora certa — um desafio errado pode te eliminar!
              </p>
            </section>

            {/* Bloqueios */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>🛡️ Bloqueios</h3>
              <p className={styles.text}>
                Alguns personagens podem <strong>bloquear</strong> ações antes que aconteçam.
                O bloqueio também pode ser desafiado — se o bloqueador estiver blefando, perde 1 influência e a ação acontece.
              </p>
            </section>

            {/* Dicas rápidas */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>💡 Dicas para Novatos</h3>
              <ul className={styles.list}>
                <li>Com <strong>7+ moedas</strong> você pode executar um Golpe de Estado. Com 10 é obrigatório.</li>
                <li><strong>Guarde suas cartas em segredo</strong> — nunca revele de graça o que você tem.</li>
                <li><strong>Observe os outros.</strong> Se alguém blefa muito no Político, bloqueie a Ajuda Externa deles.</li>
                <li>Às vezes é melhor <strong>não blefar</strong> — jogar honesto desorienta os adversários.</li>
                <li>Se você só tem 1 influência, seja mais cauteloso. Um único erro pode te eliminar.</li>
              </ul>
            </section>

          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
