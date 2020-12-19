const {
    Card: { AM, AD, A, E, S, ST, O, CO },
    Calc: { MUL, ADD, PL, ROLL, HP, CHOOSE, CASTER, TARGET, SACRIFICE },
    Targets: { SELF, OTHER, OTHERS, LEFT, RIGHT }
} = require('./definitions');

const cards = {};

const PluieDeBoulesDeFeu = cards.PluieDeBoulesDeFeu = {
    id: 'PluieDeBoulesDeFeu',
    type: AM,
    canSave: 0.5,
    canResist: true,
    canCancel: false,
    canRedirect: true,
    damage: [MUL, [ROLL, 1, 8], PL]
};

const SouffranceEmpirique = cards.SouffranceEmpirique = {
    id: 'SouffranceEmpirique',
    type: AM,
    canSave: true,
    canResist: true,
    canCancel: false,
    canRedirect: true,
    damage: [MUL, 0.5, [HP, TARGET]]
};

const VapeurExplosive = cards.VapeurExplosive = {
    id: 'VapeurExplosive',
    type: AM,
    canSave: 0.5,
    canResist: true,
    canCancel: true,
    canRedirect: true,
    damage: [MUL, [ROLL, 1, 12], PL]
};

const PotionDEnergie = cards.PotionDEnergie = {
    id: 'PotionDEnergie',
    type: A,
    canSave: false,
    canResist: false,
    canCancel: false,
    canRedirect: false,
    heal: [ROLL, 4, 6]
};

const PotionDEnergieMajeure = cards.PotionDEnergieMajeure = {
    id: 'PotionDEnergieMajeure',
    ...PotionDEnergie,
    heal: [ROLL, 5, 10]
};

const PotionDEnergieSuperieure = cards.PotionDEnergieSuperieure = {
    id: 'PotionDEnergieSuperieure',
    ...PotionDEnergie,
    heal: [ROLL, 6, 12]
};

const PotionDEnergieSupreme = cards.PotionDEnergieSupreme = {
    id: 'PotionDEnergieSupreme',
    ...PotionDEnergie,
    heal: [ROLL, 1, 100]
};

const Pulverisateur = cards.Pulverisateur = {
    id: 'Pulverisateur',
    type: AD,
    canSave: true,
    canResist: true,
    canCancel: true,
    canRedirect: true,
    damage: [MUL, [ROLL, 1, 10], PL]
};

const ProjectileMagique = cards.ProjectileMagique = {
    id: 'ProjectileMagique',
    ...Pulverisateur,
    canSave: false,
    canResist: false,
    damage: [MUL, [ROLL, 1, 4], PL]
};

const RayonAcide = cards.RayonAcide = {
    id: 'RayonAcide',
    ...Pulverisateur,
    acid: true
};

const RayonLaser = cards.RayonLaser = {
    id: 'RayonLaser',
    ...Pulverisateur
};

const SouffleEnflamme = cards.SouffleEnflamme = {
    id: 'SouffleEnflamme',
    ...Pulverisateur,
    damage: [MUL, [ROLL, 1, 10], [ADD, PL, 1]]
};

const SpiraleDeFeu = cards.SpiraleDeFeu = {
    id: 'SpiraleDeFeu',
    ...SouffleEnflamme
};

const Violence = cards.Violence = {
    id: 'Violence',
    ...Pulverisateur,
    damage: [MUL, [ROLL, 1, 12], PL]
};

const SuperBouleDeFeu = cards.SuperBouleDeFeu = {
    id: 'SuperBouleDeFeu',
    ...Pulverisateur,
    damage: [MUL, [ROLL, 1, 20], [ADD, PL, 1]]
};

const Torpide = cards.Torpide = {
    id: 'Torpide',
    ...Pulverisateur,
    savingThrow: -3,
    damage: [MUL, [ROLL, 1, 12], PL]
}

const Tourbillon = cards.Tourbillon = {
    id: 'Tourbillon',
    ...Torpide,
    damage: [MUL, [ROLL, 1, 8], PL]
}

const SuccionVampirique = cards.SuccionVampirique = {
    id: 'SuccionVampirique',
    ...Pulverisateur,
    lifesteal: true,
    damage: [MUL, [ROLL, 1, 8], PL]
};

const TransmissionVitale = cards.TransmissionVitale = {
    id: 'TransmissionVitale',
    ...SuccionVampirique,
    damage: [MUL, [ROLL, 1, 10], [PL, TARGET]]
};

const PuissanceVitale = cards.PuissanceVitale = {
    id: 'PuissanceVitale',
    type: A,
    canSave: false,
    canResist: false,
    canCancel: true,
    canRedirect: false,
    heal: [MUL, [ROLL, 1, 4], PL]
};

const PuissanceVitaleMajeure = cards.PuissanceVitaleMajeure = {
    id: 'PuissanceVitaleMajeure',
    ...PuissanceVitale,
    heal: [MUL, [ROLL, 1, 8], PL]
};

const PuissanceVitaleSuperieure = cards.PuissanceVitaleSuperieure = {
    id: 'PuissanceVitaleSuperieure',
    ...PuissanceVitale,
    heal: [MUL, [ROLL, 1, 10], PL]
};

const PuissanceVitaleSupreme = cards.PuissanceVitaleSupreme = {
    id: 'PuissanceVitaleSupreme',
    ...PuissanceVitale,
    heal: [MUL, [ROLL, 1, 12], PL]
};

const SacrificeDEmmerlaus = cards.SacrificeDEmmerlaus = {
    id: 'SacrificeDEmmerlaus',
    type: E,
    canSave: 0.5,
    canResist: false,
    canCancel: 2,
    canRedirect: false,
    target: OTHERS,
    sacrifice: [CHOOSE, HP],
    damage: SACRIFICE
};

const SanctuaireDEmmerlaus = cards.SanctuaireDEmmerlaus = {
    id: 'SanctuaireDEmmerlaus',
    type: E,
    canSave: false,
    canResist: false,
    canCancel: false,
    canRedirect: false,
    counter: 1,
    untargettable: true,
    target: SELF,
    heal: [ADD, 25, [MUL, [ROLL, 1, 8], PL]]
};

const Sommeil = cards.Sommeil = {
    id: 'Sommeil',
    type: S,
    canSave: true,
    canResist: true,
    canCancel: true,
    canRedirect: true,
    counter: 1,
    target: LEFT,
    inactive: true
};

const Telepathie = cards.Telepathie = {
    id: 'Telepathie',
    type: S,
    canSave: true,
    canResist: false,
    canCancel: false,
    canRedirect: true,
    reveal: true,
    target: OTHER
}

const TenebresDEmmerlaus = cards.TenebresDEmmerlaus = {
    id: 'TenebresDEmmerlaus',
    type: E,
    canSave: 0.5,
    canResist: false,
    canCancel: false,
    canRedirect: false,
    target: OTHERS,
    damage: [MUL, [ROLL, 1, 12], PL]
};

const TransfertDeCorps = cards.TransfertDeCorps = {
    id: 'TransfertDeCorps',
    type: S,
    canSave: true,
    canResist: true,
    canCancel: false,
    canRedirect: false,
    transfertBodies: true
};

const VitesseDouble = cards.VitesseDouble = {
    id: 'VitesseDouble',
    type: ST,
    canSave: false,
    canResist: false,
    canCancel: false,
    canRedirect: false,
    target: SELF,
    counter: 1,
    haste: 2
}

const AnneauDePuissance1 = cards.AnneauDePuissance1 = {
    id: 'AnneauDePuissance1',
    type: O,
    powerLevel: 1
};

const AnneauDePuissance2 = cards.AnneauDePuissance2 = {
    ...AnneauDePuissance1,
    id: 'AnneauDePuissance2',
};

const AnneauDePuissance3 = cards.AnneauDePuissance3 = {
    ...AnneauDePuissance1,
    id: 'AnneauDePuissance3',
};

const AnneauDePuissance4 = cards.AnneauDePuissance4 = {
    ...AnneauDePuissance1,
    id: 'AnneauDePuissance4',
};

const AnneauDePuissance5 = cards.AnneauDePuissance5 = {
    ...AnneauDePuissance1,
    id: 'AnneauDePuissance5',
};

const AnneauDePuissance6 = cards.AnneauDePuissance6 = {
    id: 'AnneauDePuissance6',
    ...AnneauDePuissance1,
    powerLevel: 2
};

const AnneauDePuissance7 = cards.AnneauDePuissance7 = {
    ...AnneauDePuissance6,
    id: 'AnneauDePuissance7',
};

const AnneauDePuissance8 = cards.AnneauDePuissance8 = {
    ...AnneauDePuissance6,
    id: 'AnneauDePuissance8',
};

const AnneauDePuissance9 = cards.AnneauDePuissance9 = {
    ...AnneauDePuissance1,
    id: 'AnneauDePuissance9',
    powerLevel: 3
};

const AnneauDeResurrection = cards.AnneauDeResurrection = {
    id: 'AnneauDeResurrection',
    type: O,
    resurrect: true
};

const RobeDAbsorption = cards.RobeDAbsorption = {
    id: 'RobeDAbsorption',
    type: O,
    absorb: [ROLL, 1, 10]
};

const RobeDeProtection = cards.RobeDeProtection = {
    id: 'RobeDeProtection',
    type: O,
    savingThrow: 2
};

const RobeDeProtection2 = cards.RobeDeProtection2 = {
    id: 'RobeDeProtection2',
    type: O,
    savingThrow: 3
};

module.exports = cards;
