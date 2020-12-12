const {
    CardTypes: { AM, AD, A, E, S, ST, O, CO },
    Calc: { MUL, ADD, PL, ROLL, HP, CHOOSE, CASTER, TARGET },
    Targets: { SELF, OTHER, OTHERS, LEFT, RIGHT }
} = require('./definitions');

const PluieDeBoulesDeFeu = {
    type: AM,
    canSave: 0.5,
    canResist: true,
    canCancel: false,
    canRedirect: true,
    damage: [MUL, [ROLL, 1, 8], PL]
};

const SouffranceEmpirique = {
    type: AM,
    canSave: true,
    canResist: true,
    canCancel: false,
    canRedirect: true,
    damage: [MUL, 0.5, [HP, TARGET]]
};

const VapeurExplosive = {
    type: AM,
    canSave: 0.5,
    canResist: true,
    canCancel: true,
    canRedirect: true,
    damage: [MUL, [ROLL, 1, 12], PL]
};

const PotionDEnergie = {
    type: A,
    canSave: false,
    canResist: false,
    canCancel: false,
    canRedirect: false,
    heal: [ROLL, 4, 6]
};

const PotionDEnergieMajeure = { ...PotionDEnergie, heal: [ROLL, 5, 10] };
const PotionDEnergieSuperieure = { ...PotionDEnergie, heal: [ROLL, 6, 12] };
const PotionDEnergieSupreme = { ...PotionDEnergie, heal: [ROLL, 1, 100] };

const Pulverisateur = {
    type: AD,
    canSave: true,
    canResist: true,
    canCancel: true,
    canRedirect: true,
    damage: [MUL, [ROLL, 1, 10], PL]
};

const ProjectileMagique = {
    ...Pulverisateur,
    canSave: false,
    canResist: false,
    damage: [MUL, [ROLL, 1, 4], PL]
};

const RayonAcide = { ...Pulverisateur, acid: true };
const RayonLaser = { ...Pulverisateur };
const SouffleEnflamme = { ...Pulverisateur, damage: [MUL, [ROLL, 1, 10], [ADD, PL, 1]] };
const SpiraleDeFeu = { ...SouffleEnflamme };

const Violence = { ...Pulverisateur, damage: [MUL, [ROLL, 1, 12], PL] };

const SuperBouleDeFeu = { ...Pulverisateur, damage: [MUL, [ROLL, 1, 20], [ADD, PL, 1]] };

const Torpide = {
    ...Pulverisateur,
    canSave: -3,
    damage: [MUL, [ROLL, 1, 12], PL]
}

const Tourbillon = {
    ...Torpide,
    damage: [MUL, [ROLL, 1, 8], PL]
}

const SuccionVampirique = {
    ...Pulverisateur,
    lifesteal: true,
    damage: [MUL, [ROLL, 1, 8], PL]
};

const TransmissionVitale = {
    ...SuccionVampirique,
    damage: [MUL, [ROLL, 1, 10], [PL, TARGET]]
};

const PuissanceVitale = {
    type: A,
    canSave: false,
    canResist: false,
    canCancel: true,
    canRedirect: false,
    heal: [MUL, [ROLL, 1, 4], PL]
};

const PuissanceVitaleMajeure = { ...PuissanceVitale, heal: [MUL, [ROLL, 1, 8], PL] };
const PuissanceVitaleSuperieure = { ...PuissanceVitale, heal: [MUL, [ROLL, 1, 10], PL] };
const PuissanceVitaleSupreme = { ...PuissanceVitale, heal: [MUL, [ROLL, 1, 12], PL] };

const SacrificeDEmmerlaus = {
    type: E,
    canSave: 0.5,
    canResist: false,
    canCancel: 2,
    canRedirect: false,
    target: OTHERS,
    sacrifice: [CHOOSE, HP],
    damage: 'sacrifice'
};

const SanctuaireDEmmerlaus = {
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

const Sommeil = {
    type: S,
    canSave: true,
    canResist: true,
    canCancel: true,
    canRedirect: true,
    counter: 1,
    target: LEFT,
    inactive: true
};

const Telepathie = {
    type: S,
    canSave: true,
    canResist: false,
    canCancel: false,
    canRedirect: true,
    reveal: true,
    target: OTHER
}

const TenebresDEmmerlaus = {
    type: E,
    canSave: 0.5,
    canResist: false,
    canCancel: false,
    canRedirect: false,
    target: OTHERS,
    damage: [MUL, [ROLL, 1, 12], PL]
};

const TransfertDeCorps = {
    type: S,
    canSave: true,
    canResist: true,
    canCancel: false,
    canRedirect: false,
    transfertBodies: true
};

const VitesseDouble = {
    type: ST,
    canSave: false,
    canResist: false,
    canCancel: false,
    canRedirect: false,
    target: SELF,
    counter: 1,
    haste: 2
}

const AnneauDePuissance1 = {
    type: O,
    powerLevel: 1
};

const AnneauDePuissance2 = { ...AnneauDePuissance1 };
const AnneauDePuissance3 = { ...AnneauDePuissance1 };
const AnneauDePuissance4 = { ...AnneauDePuissance1 };
const AnneauDePuissance5 = { ...AnneauDePuissance1 };

const AnneauDePuissance6 = { ...AnneauDePuissance1, powerLevel: 2 };
const AnneauDePuissance7 = { ...AnneauDePuissance6 };
const AnneauDePuissance8 = { ...AnneauDePuissance6 };

const AnneauDePuissance9 = { ...AnneauDePuissance1, powerLevel: 3 };

const AnneauDeResurrection = {
    type: O,
    resurrect: true
};

const RobeDAbsorption = {
    type: O,
    absorb: [ROLL, 1, 10]
};

const RobeDeProtection = {
    type: O,
    savingThrow: 2
};

const RobeDeProtection2 = {
    type: O,
    savingThrow: 3
};
