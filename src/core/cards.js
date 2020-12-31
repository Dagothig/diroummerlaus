'use strict';

const {
    Card: { AM, AD, A, E, S, ST, O, CO, SP, CA },
    Calc: { MUL, ADD, SUB, PL, ROLL, HP, CHOOSE, CASTER, TARGET, SACRIFICE, ALIVE },
    Targets: { SELF, OTHER, OTHERS, LEFT, RIGHT, ANY },
    Item: { ALL, EQUIPPED, RING, ROBE, EXCEPT, CHOOSE: ZONE_CHOOSE },
    Play: { ACTIVATE, EFFECT }
} = require('./definitions');

const potion = {
    type: A,
    canSave: false,
    canResist: false,
    canCancel: false,
    canRedirect: false,
};

const heal = {
    type: A,
    canSave: false,
    canResist: false,
    canCancel: true,
    canRedirect: false,
}

const singleTarget = {
    type: AD,
    canSave: true,
    canResist: true,
    canCancel: true,
    canRedirect: true,
};

const annulation = {
    type: CA,
    canSave: false,
    canResist: false,
    canCancel: false,
    canRedirect: false,
    cancel: true,
    target: ANY,
    play: ACTIVATE
};

const mirroir = {
    type: CA,
    canSave: false,
    canResist: false,
    canCancel: false,
    canRedirect: false,
    redirect: true
};

const resistance = {
    type: CA,
    canSave: true,
    canResist: false,
    canCancel: false,
    canRedirect: false,
    savingThrow: PL,
    counter: 1,
    play: EFFECT
};

module.exports = [
    {
        id: 'PluieDeBoulesDeFeu',
        type: AM,
        canSave: 0.5,
        canResist: true,
        canCancel: false,
        canRedirect: true,
        damage: [ROLL, PL, 8]
    },
    {
        id: 'PotionDEnergie',
        ...potion,
        heal: [ROLL, 4, 6],
    },
    {
        id: 'PotionDEnergieMajeure',
        ...potion,
        heal: [ROLL, 5, 10]
    },
    {
        id: 'PotionDEnergieSuperieure',
        ...potion,
        heal: [ROLL, 6, 12]
    },
    {
        id: 'PotionDEnergieSupreme',
        ...potion,
        heal: [ROLL, 1, 100]
    },
    {
        id: 'ProjectileMagique',
        ...singleTarget,
        canSave: false,
        canResist: false,
        damage: [ROLL, PL, 4]
    },
    {
        id: 'PuissanceVitale',
        ...heal,
        heal: [ROLL, PL, 4]
    },
    {
        id: 'PuissanceVitaleMajeure',
        ...heal,
        heal: [ROLL, PL, 8]
    },
    {
        id: 'PuissanceVitaleSuperieure',
        ...heal,
        heal: [ROLL, PL, 10]
    },
    {
        id: 'PuissanceVitaleSupreme',
        ...heal,
        heal: [ROLL, PL, 12]
    },
    {
        id: 'Pulverisateur',
        ...singleTarget,
        damage: [ROLL, PL, 10]
    },
    {
        id: 'RayonAcide',
        ...singleTarget,
        acid: true,
        damage: [ROLL, PL, 10]
    },
    {
        id: 'RayonLaser',
        ...singleTarget,
        damage: [ROLL, PL, 10]
    },
    {
        id: 'SacrificeDEmmerlaus',
        type: E,
        canSave: 0.5,
        canResist: false,
        canCancel: 2,
        canRedirect: false,
        target: OTHERS,
        sacrifice: [CHOOSE, HP],
        damage: SACRIFICE
    },
    {
        id: 'SanctuaireDEmmerlaus',
        type: E,
        canSave: false,
        canResist: false,
        canCancel: false,
        canRedirect: false,
        counter: 1,
        untargettable: true,
        target: SELF,
        heal: [ADD, 25, [ROLL, PL, 8]]
    },
    {
        id: 'Sommeil',
        type: S,
        canSave: true,
        canResist: true,
        canCancel: true,
        canRedirect: true,
        counter: 1,
        target: LEFT,
        inactive: true
    },
    {
        id: 'SouffleEnflamme',
        ...singleTarget,
        damage: [ROLL, [ADD, PL, 1], 10]
    },
    {
        id: 'SouffranceEmpirique',
        type: AM,
        canSave: true,
        canResist: true,
        canCancel: false,
        canRedirect: true,
        damage: [MUL, 0.5, [HP, TARGET]]
    },
    {
        id: 'SpiraleDeFeu',
        ...singleTarget,
        damage: [ROLL, [ADD, PL, 1], 10]
    },
    {
        id: 'SuccionVampirique',
        ...singleTarget,
        lifesteal: true,
        damage: [ROLL, PL, 8]
    },
    {
        id: 'SuperBouleDeFeu',
        ...singleTarget,
        damage: [ROLL, [ADD, PL, 1], 20]
    },
    {
        id: 'Telepathie',
        type: S,
        canSave: true,
        canResist: false,
        canCancel: false,
        canRedirect: true,
        reveal: true,
        target: OTHER
    },
    {
        id: 'TenebresDEmmerlaus',
        type: E,
        canSave: 0.5,
        canResist: false,
        canCancel: false,
        canRedirect: false,
        target: OTHERS,
        damage: [ROLL, PL, 12]
    },
    {
        id: 'Torpide',
        ...singleTarget,
        savingThrow: -3,
        damage: [ROLL, PL, 12]
    },
    {
        id: 'Tourbillon',
        ...singleTarget,
        damage: [ROLL, PL, 8]
    },
    {
        id: 'TransfertDeCorps',
        type: S,
        canSave: true,
        canResist: true,
        canCancel: false,
        canRedirect: false,
        transfertBodies: true,
        target: OTHER
    },
    {
        id: 'TransmissionVitale',
        ...singleTarget,
        lifesteal: true,
        damage: [ROLL, [PL, TARGET], 10]
    },
    {
        id: 'VapeurExplosive',
        type: AM,
        canSave: 0.5,
        canResist: true,
        canCancel: true,
        canRedirect: true,
        damage: [ROLL, PL, 12]
    },
    {
        id: 'Violence',
        ...singleTarget,
        damage: [ROLL, PL, 12]
    },
    {
        id: 'VitesseDouble',
        type: ST,
        canSave: false,
        canResist: false,
        canCancel: false,
        canRedirect: false,
        target: SELF,
        counter: 1,
        haste: 2
    },
    { id: 'AnneauDePuissance1', type: O, powerLevel: 1, item: RING },
    { id: 'AnneauDePuissance2', type: O, powerLevel: 1, item: RING },
    { id: 'AnneauDePuissance3', type: O, powerLevel: 1, item: RING },
    { id: 'AnneauDePuissance4', type: O, powerLevel: 1, item: RING },
    { id: 'AnneauDePuissance5', type: O, powerLevel: 1, item: RING },
    { id: 'AnneauDePuissance6', type: O, powerLevel: 2, item: RING },
    { id: 'AnneauDePuissance7', type: O, powerLevel: 2, item: RING },
    { id: 'AnneauDePuissance8', type: O, powerLevel: 2, item: RING },
    { id: 'AnneauDePuissance9', type: O, powerLevel: 3, item: RING },
    { id: 'AnneauDeResurrection', type: O, resurrect: true, item: RING },
    { id: 'RobeDAbsorption', type: O, absorb: [ROLL, 1, 10], item: ROBE },
    { id: 'RobeDeProtection', type: O, savingThrow: 2, item: ROBE },
    { id: 'RobeDeProtection2', type: O, savingThrow: 3, item: ROBE },
    {
        id: 'Depouillement',
        type: CO,
        canSave: true,
        canResist: true,
        canCancel: true,
        canRedirect: true,
        remove: EQUIPPED
    },
    {
        id: 'DissipationAnneau1',
        type: CO,
        canSave: true,
        canResist: true,
        canCancel: true,
        canRedirect: true,
        remove: [ZONE_CHOOSE, RING]
    },
    {
        id: 'DissipationAnneau2',
        type: CO,
        canSave: true,
        canResist: true,
        canCancel: true,
        canRedirect: true,
        remove: [ZONE_CHOOSE, RING]
    },
    {
        id: 'LaMainQuiVole1',
        type: CO,
        canSave: true,
        canResist: false,
        canCancel: true,
        canRedirect: true,
        steal: [ZONE_CHOOSE, EQUIPPED]
    },
    {
        id: 'LaMainQuiVole2',
        type: CO,
        canSave: true,
        canResist: false,
        canCancel: true,
        canRedirect: true,
        steal: [ZONE_CHOOSE, EQUIPPED]
    },
    { id: 'Annulation1', ...annulation },
    { id: 'Annulation2', ...annulation },
    { id: 'Annulation3', ...annulation },
    { id: 'Annulation4', ...annulation },
    { id: 'Annulation5', ...annulation },
    { id: 'Annulation6', ...annulation },
    { id: 'Mirroir1', ...mirroir },
    { id: 'Mirroir2', ...mirroir },
    { id: 'Mirroir3', ...mirroir },
    { id: 'Mirroir4', ...mirroir },
    { id: 'Mirroir5', ...mirroir },
    { id: 'Resistance1', ...resistance },
    { id: 'Resistance2', ...resistance },
    { id: 'Resistance3', ...resistance },
    { id: 'Resistance4', ...resistance },
    { id: 'Resistance5', ...resistance },
    { id: 'Resistance6', ...resistance },
    {
        id: 'AngeGardien',
        ...singleTarget,
        damage: [ROLL, PL, 20],
        savingThrow: -3
    },
    {
        id: 'ArcElectrique',
        ...singleTarget,
        damage: [ROLL, PL, 6]
    },
    {
        id: 'AuSeuilDeLaMort',
        ...singleTarget,
        damage: [SUB, [HP, TARGET], [ROLL, 1, 10]]
    },
    {
        id: 'BouleAcidifiee',
        ...singleTarget,
        damage: [ROLL, PL, 8],
        acid: true
    },
    {
        id: 'BouleDeFeu',
        ...singleTarget,
        damage: [ROLL, PL, 8]
    },
    {
        id: 'CarquoisDeFlechesMagiques',
        type: AM,
        canSave: false,
        canResist: false,
        canCancel: false,
        canRedirect: true,
        damage: [ROLL, PL, 4]
    },
    {
        id: 'CerceauDeFeu',
        ...singleTarget,
        damage: [ROLL, [ADD, PL, 1], 4],
        canSave: false,
        canResist: false
    },
    {
        id: 'ChampsDeclairs',
        type: AM,
        canSave: 0.5,
        canResist: true,
        canCancel: false,
        canRedirect: true,
        damage: [ROLL, PL, 6]
    },
    {
        id: 'ChampsVampiriquesDEmmerlaus',
        type: E,
        canSave: 0.5,
        canResist: false,
        canCancel: false,
        canRedirect: false,
        damage: [ROLL, PL, 8],
        lifesteal: true
    },
    {
        id: 'ColereDuMagicien',
        type: S,
        canSave: true,
        canResist: true,
        canCancel: true,
        canRedirect: true,
        target: OTHER,
        combo: { count: 1, multiplier: 2, type: AD }
    },
    {
        id: 'CoupDeVent',
        ...singleTarget,
        savingThrow: -3,
        damage: [MUL, [ROLL, 1, 6], PL]
    },
    {
        id: 'Cumulonimbus',
        ...singleTarget,
        savingThrow: -3,
        damage: [MUL, [ROLL, 1, 10], PL]
    },
    {
        id: 'Desintegration',
        ...singleTarget,
        canRedirect: false,
        desintegrate: true
    },
    {
        id: 'Destruction',
        ...singleTarget,
        damage: [MUL, [ROLL, 1, 20], PL]
    },
    {
        id: 'DestructionMassive',
        type: AM,
        canSave: 0.5,
        canResist: true,
        canCancel: true,
        canRedirect: true,
        damage: [MUL, [ROLL, 1, 20], PL]
    },
    {
        id: 'DiscoLaser',
        type: AM,
        canSave: 0.5,
        canResist: true,
        canCancel: true,
        canRedirect: true,
        damage: [MUL, [ROLL, 1, 10], PL]
    },
    {
        id: 'Dommage',
        ...singleTarget,
        damage: [MUL, 5, PL]
    },
    {
        id: 'DommageSuperieur',
        ...singleTarget,
        damage: [MUL, 10, PL]
    },
    {
        id: 'DonAdverse',
        ...singleTarget,
        damage: [MUL, [ROLL, 1, 8], [PL, TARGET]],
        lifesteal: true
    },
    {
        id: 'Eclair',
        ...singleTarget,
        damage: [MUL, [ROLL, 1, 6], PL]
    },
    {
        id: 'EnergieAcide',
        ...singleTarget,
        damage: [MUL, [ROLL, 1, 6], PL],
        acid: true
    },
    {
        id: 'EruptionAcide',
        ...singleTarget,
        damage: [MUL, [ROLL, 1, 12], PL],
        acid: true
    },
    {
        id: 'Etouffement',
        ...singleTarget,
        savingThrow: -4,
        damage: [MUL, [ROLL, 1, 4], PL]
    },
    {
        id: 'ExplosionEnergetique',
        ...singleTarget,
        damage: [MUL, [ROLL, 1, 12], PL]
    },
    {
        id: 'FlecheMagique',
        ...singleTarget,
        canSave: false,
        canResist: false,
        damage: [MUL, [ROLL, 1, 4], PL]
    },
    {
        id: 'FlechetteAcide',
        ...singleTarget,
        canSave: false,
        canResist: false,
        damage: [MUL, [ROLL, 1, 6], PL]
    },
    {
        id: 'FouetEnflamme',
        ...singleTarget,
        damage: [MUL, [ROLL, 1, 6], [ADD, PL, 1]]
    },
    {
        id: 'GlobeInfernal',
        ...singleTarget,
        damage: [MUL, [ROLL, 1, 8], PL]
    },
    {
        id: 'Grenacide',
        ...singleTarget,
        damage: [MUL, [ROLL, 1, 20], PL],
        acid: true
    },
    {
        id: 'InterventionDivineEmmerlaus',
        type: E,
        canSave: false,
        canResist: false,
        canCancel: 2,
        canRedirect: false,
        multi: [
            {
                target: OTHERS,
                remove: ALL,
            },
            {
                target: SELF,
                heal: 25,
                remove: [EXCEPT, ALL, CHOOSE]
            },
        ],
        reshuffle: true
    },
    {
        id: 'LaFontaine',
        type: A,
        canSave: false,
        canResist: false,
        canCancel: true,
        canRedirect: false,
        multi: [
            {
                target: OTHERS,
                heal: 20
            },
            {
                target: SELF,
                heal: [MUL, 20, ALIVE]
            },
        ]
    },
    {
        id: 'LanceFlamme',
        type: AD,
        canSave: true,
        canResist: true,
        canCancel: true,
        canRedirect: true,
        damage: [MUL, [ROLL, 1, 12], [ADD, PL, 1]]
    },
    {
        id: 'MainBrulante',
        type: AD,
        canResist: true,
        canCancel: true,
        canRedirect: true,
        multi: [
            { canSave: true, damage: [ROLL, 1, 12] },
            { canSave: true, damage: [ROLL, 1, 12] },
            { canSave: true, damage: [ROLL, 1, 12] },
            { canSave: true, damage: [ROLL, 1, 12] },
            { canSave: true, damage: [ROLL, 1, 12] },
        ]
    },
    {
        id: 'Malediction',
        type: SP,
        canSave: false,
        canResist: false,
        canCancel: 2,
        canRedirect: true,
        target: OTHER,
        savingThrow: -5
    },
    {
        id: 'MissileNucleaire',
        ...singleTarget,
        damage: [MUL, [ROLL, 1, 20], PL]
    },
];
