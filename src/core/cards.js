const { CardTypes } = require('./definitions');

module.exports.PluieDeBoulesDeFeu = {
    type: CardTypes.AM,
    canSave: true,
    canResist: true,
    canCancel: false,
    canRedirect: true,
    async onPlay({ game, wizard, targets, card }) {
        await game.damage({
            ...card,
            wizard,
            targets,
            amount: await game.roll(1, 8) * wizard.powerLevel
        });
    }
};

/*
const PotionDEnergie = {
    type: CardTypes.A,
    canSave: false,
    canResist: false,
    canCancel: false,
    canRedirect: false,
    play: [
        [Roll, 4, 6],
        [Heal]
    ]
};

const PotionDEnergiMajeure = {
    ...EnergyPotion,
    play: [
        [Roll, 5, 10],
        [Heal]
    ]
};

const PotionDEnergieSuperieure = {
    ...EnergyPotion,
    play: [
        [Roll, 6, 12],
        [Heal]
    ]
};

const PotionDEnergieSupreme = {
    ...EnergyPotion,
    play: [
        [Roll, 1, 100],
        [Heal]
    ]
};

const ProjectileMagique = {
    type: CardTypes.AD,
    canSave: false,
    canResist: false,
    canCancel: true,
    canRedirect: true,
    play: [
        [Roll, 1, 4],
        [Source],
        [PlayerPowerLevel],
        [Mul],
        [Damage]
    ]
};

const PuissanceVitale = {
    type: CardTypes.A,
    canSave: false,
    canResist: false,
    canCancel: true,
    canRedirect: false,
    play: [
        [Roll, 1, 4],
        [Source],
        [PlayerPowerLevel],
        [Heal]
    ]
};

const PuissanceVitaleMajeure = {
    ...PuissanceVitale,
    play: [
        [Roll, 1, 8],
        [Source],
        [PlayerPowerLevel],
        [Heal]
    ]
};

const PuissanceVitaleSuperieure = {
    ...PuissanceVitale,
    play: [
        [Roll, 1, 10],
        [Source],
        [PlayerPowerLevel],
        [Heal]
    ]
};

const PuissanceVitaleSupreme = {
    ...PuissanceVitale,
    play: [
        [Roll, 1, 12],
        [Source],
        [PlayerPowerLevel],
        [Heal]
    ]
};

const Pulverisateur = {
    type: CardTypes.AD,
    canSave: true,
    canresist: true,
    canCancel: true,
    canRedirect: true,
    play: [
        [Roll, 1, 10],
        [Source],
        [PlayerPowerLevel],
        [Damage]
    ]
};

const RayonAcide = {
    type: CardTypes.AD,
    canSave: true,
    canResist: true,
    canCancel: true,
    canRedirect: true,
    play: [
        [Roll, 1, 10],
        [Source],
        [PlayerPowerLevel],
        [Damage],
        [Roll, 1, 6],
        [Equal, 1],
        [Success, [
            [ChooseEquipment],
            [Discard]
        ]]
    ]
};

const RayonLaser = {
    ...Pulverisateur
};

const SacrificeDEmmerlaus = {
    type: CardTypes.E,
    canSave: true,
    canResist: false,
    canCancel: 2,
    canRedirect: false,
    beforePlay: [
        [Source],
        [PlayerHitPoints],
        [Choose],
        [TargetEnemies]
    ],
    play: [
        [Damage]
    ],
    resist: [
        [Multiply, 0.5],
        [Damage]
    ]
};

const SanctuaireDEmmerlaus = {
    type: CardTypes.E,
    canSave: false,
    canResist: false,
    canCancel: false,
    canRedirect: false,
    counter: 1,
    beforePlay: [
        [Source],
        [TargetPlayer]
    ],
    play: [
        [Roll, 1, 8],
        [Add, 25],
        [Heal],
        [Targettable, false]
    ],
    exitPlay: [
        [Targettable, true]
    ]
};

const Sommeil = {
    type: CardTypes.S,
    canSave: true,
    canResist: true,
    canCancel: true,
    canRedirect: true,
    counter: 0,
    beforePlay: [
        [TargetLeft]
    ],
    play: [
        [Inactive, true]
    ],
    exitPlay: [
        [Inactive, false]
    ]
};

const SouffleEnflamme = {
    ...Pulverisateur,
    play: [
        [Roll, 1, 8],
        [Source],
        [PlayerPowerLevel],
        [Add, 1],
        [Mul]
        [Damage]
    ]
};

const SouffranceEmpirique = {
    type: CardTypes.AM,
    canSave: true,
    canResist: true,
    canCancel: false,
    canRedirect: true,
    play: [
        [PlayerHitPoints],
        [Mul, 0.5],
        [Damage]
    ]
}

const SpiraleDeFeu = {
    ...Pulverisateur,
    play: [
        [Roll, 1, 10],
        [Source],
        [PlayerPowerLevel],
        [Add, 1],
        [Mul]
        [Damage]
    ]
};

const SuccionVampirique = {
    ...Pulverisateur,
    play: [
        [Roll, 1, 8],
        [Source],
        [PlayerPowerLevel],
        [Mul]
        [Damage],
        [Source],
        [Heal]
    ]
};

const SuperBouleDeFeu = {
    ...Pulverisateur,
    play: [
        [Roll, 1, 20],
        [Source],
        [PlayerPowerLevel],
        [Add, 1],
        [Mul]
        [Damage]
    ]
};

const Telepathie = {
    type: CardTypes.S,
    canSave: true,
    canResist: false,
    canCancel: false,
    canRedirect: true,
    beforePlay: [
        [TargetEnemy]
    ],
    play: [
        [Source],
        [HandVisibility, true],
        [Target],
        [Source],
        [Confirm],
        [HandVisibility, false]
    ]
}

const TenebresDEmmerlaus = {
    type: CardTypes.E,
    canSave: true,
    canResist: false,
    canCancel: false,
    canRedirect: false,
    beforePlay: [
        [Roll, 1, 12],
        [PlayerPowerLevel],
        [Mul],
        [TargetEnemies]
    ],
    play: [
        [Damage]
    ],
    resist: [
        [Mul, 0.5],
        [Damage]
    ]
};
*/
