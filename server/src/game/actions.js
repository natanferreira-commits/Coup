// Action definitions
const ACTION_DEFS = {
  renda: {
    basic: true,
    challengeable: false,
    blockable: false,
    requiresTarget: false,
  },
  ajuda_externa: {
    basic: true,
    challengeable: false,
    blockable: true,
    blockedBy: ['politico'],
    requiresTarget: false,
    anyoneCanBlock: true,
  },
  golpe: {
    basic: true,
    cost: 7,
    challengeable: false,
    blockable: false,
    requiresTarget: true,
    targetLosesInfluence: true,
  },
  taxar: {
    character: 'politico',
    challengeable: true,
    blockable: false,
    requiresTarget: false,
  },
  roubar: {
    character: 'empresario',
    challengeable: true,
    blockable: true,
    blockedBy: ['juiz', 'guarda_costas'],
    requiresTarget: true,
    anyoneCanBlock: false,
  },
  assassinar: {
    character: 'assassino',
    cost: 3,
    challengeable: true,
    blockable: true,
    blockedBy: ['guarda_costas'],
    requiresTarget: true,
    targetLosesInfluence: true,
    anyoneCanBlock: false,
  },
  investigar: {
    character: 'investigador',
    challengeable: true,
    blockable: true,
    blockedBy: ['juiz'],
    requiresTarget: true,
    anyoneCanBlock: false,
  },
};

const ACTION_NAMES = {
  renda: 'Renda',
  ajuda_externa: 'Ajuda Externa',
  golpe: 'Golpe',
  taxar: 'Taxação (Político)',
  roubar: 'Roubo (Empresário)',
  assassinar: 'Assassinato (Assassino)',
  investigar: 'Investigação (Investigador)',
};

const CHARACTER_NAMES = {
  politico: 'Político',
  empresario: 'Empresário',
  investigador: 'Investigador',
  juiz: 'Juiz',
  assassino: 'Assassino',
  guarda_costas: 'Guarda-Costas',
};

function getBlockers(actionType) {
  return ACTION_DEFS[actionType]?.blockedBy || [];
}

module.exports = { ACTION_DEFS, ACTION_NAMES, CHARACTER_NAMES, getBlockers };
