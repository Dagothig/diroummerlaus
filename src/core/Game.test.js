const test = require('ava');
const {
    Game,
    cards,
    definitions: { Card, Event, Calc, Targets, Play, Zone }
} = require('.');
const AsyncQueue = require('./AsyncQueue');

const baseArgs = {
    players: ['P1', 'P2'],
    rng: {
        shuffle: Function.id,
        dice: (amount, sides) => amount * (1 + sides) / 2
    },
    cards: []
};

function getGame(args) {
    const queue = new AsyncQueue();
    const game = new Game({ ...baseArgs, ...args });

    game.onEvent((t, p) => queue.enqueue([t, p]));

    const $run = game.$run();

    return [game, queue, $run];
}

test('Base turn', async t => {
    const [game, queue] = getGame({ cards: Array.gen(11, i => ({ id: i })) });

    const [
        [drawP1, drawP1Payload],
        [drawP2, drawP2Payload],
        [turn, turnPayload],
        [question, questionPayload]
    ] = await queue.$dequeue(4);

    t.is(drawP1, Event.DRAW);
    t.like(drawP1Payload, { wizard: 'P1', cards: [6, 7, 8, 9, 10] });

    t.is(drawP2, Event.DRAW);
    t.like(drawP2Payload, { wizard: 'P2', cards: [1, 2, 3, 4, 5] });

    t.is(turn, Event.TURN);
    t.like(turnPayload, { wizard: 'P1' });

    t.is(question, Event.QUESTION);
    t.like(questionPayload, {
        wizard: 'P1',
        choices: [
            [6, [Zone.TALON]],
            [7, [Zone.TALON]],
            [8, [Zone.TALON]],
            [9, [Zone.TALON]],
            [10, [Zone.TALON]],
        ]
    });

    game.send('P1', 6, Zone.TALON);

    const [
        [discard, discardPayload],
        [drawMissing, drawMissingPayload],
        [newTurn, newTurnPayload]
    ] = await queue.$dequeue(3);

    t.is(discard, Event.DISCARD);
    t.like(discardPayload, { wizard: 'P1', card: 6 });

    t.is(drawMissing, Event.DRAW);
    t.like(drawMissingPayload, { wizard: 'P1', cards: [0] });

    t.is(newTurn, Event.TURN);
    t.like(newTurnPayload, { wizard: 'P2' });
});

test('Play card types', async t => {
    const cards = [
        { id: 'play', play: Play.ACTIVATE, target: Targets.SELF },
        { id: 'effect', play: Play.EFFECT, target: Targets.SELF },
        { id: 'equip', play: Play.EQUIP, target: Targets.SELF }
    ];

    const [game, queue] = getGame({ cards });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'play', Zone.UNSPECIFIED);

    const [[activate, activatePayload], [discard, discardPayload]] = await queue.$dequeue(2);
    t.is(activate, Event.ACTIVATE);
    t.like(activatePayload, { wizard: 'P1', card: 'play', targets: ['P1'] });
    t.is(discard, Event.DISCARD);
    t.like(discardPayload, { wizard: 'P1', card: 'play' });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'effect', Zone.UNSPECIFIED);

    const [[effect, effectPayload]] = await queue.$dequeue();
    t.is(effect, Event.AFFECT);
    t.like(effectPayload, { wizard: 'P1', card: 'effect', targets: ['P1'] });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'equip', Zone.UNSPECIFIED);

    const [[equip, equipPayload]] = await queue.$dequeue();
    t.is(equip, Event.EQUIP);
    t.like(equipPayload, { wizard: 'P1', card: 'equip', targets: ['P1'] });
});

test('Target types', async t => {
    const cards = [
        { id: 'self', play: Play.EQUIP, target: Targets.SELF },
        { id: 'other', play: Play.EQUIP, target: Targets.OTHER },
        { id: 'others', play: Play.EQUIP, target: Targets.OTHERS },
        { id: 'left', play: Play.EQUIP, target: Targets.LEFT },
        { id: 'right', play: Play.EQUIP, target: Targets.RIGHT }
    ];

    const [game, queue] = getGame({ cards, players: [...baseArgs.players, 'P3'] });

    // Self
    const [, q1p] = await queue.$find(([type]) => type === Event.QUESTION);
    t.like(q1p, {
        wizard: 'P1',
        choices: [
            ['self', [Zone.UNSPECIFIED, Zone.TALON]],
            ['other', ['P2', 'P3', Zone.TALON]],
            ['others', [Zone.UNSPECIFIED, Zone.TALON]],
            ['left', [Zone.UNSPECIFIED, Zone.TALON]],
            ['right', [Zone.UNSPECIFIED, Zone.TALON]]
        ]
    });

    game.send('P1', 'self', Zone.UNSPECIFIED);

    const [[self, selfp]] = await queue.$dequeue();
    t.is(self, Event.EQUIP);
    t.like(selfp, { wizard: 'P1', card: 'self', targets: ['P1'] });

    // Other
    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'other', 'P2');

    const [[, otherp]] = await queue.$dequeue();
    t.like(otherp, { wizard: 'P1', card: 'other', targets: ['P2'] });

    // Others
    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'others', Zone.UNSPECIFIED);

    const [[, othersp]] = await queue.$dequeue();
    t.like(othersp, { wizard: 'P1', card: 'others', targets: ['P2', 'P3'] });

    // Left
    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'left', Zone.UNSPECIFIED);

    const [[, leftp]] = await queue.$dequeue();
    t.like(leftp, { wizard: 'P1', card: 'left', targets: ['P3'] });

    // Right
    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'right', Zone.UNSPECIFIED);

    const [[, rightp]] = await queue.$dequeue();
    t.like(rightp, { wizard: 'P1', card: 'right', targets: ['P2'] });
});

test('Damage', async t => {
    const [game, queue] = getGame({ cards: [
        { id: 'dmg', damage: 5, target: Targets.OTHER, play: Play.ACTIVATE }
    ] });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'dmg', 'P2');

    const [[activate], [damage, damagePayload], [discard]] = await queue.$dequeue(3);

    t.is(activate, Event.ACTIVATE);
    t.is(damage, Event.STAT);
    t.like(damagePayload, { wizard: 'P2', hitPoints: -5 });
    t.is(discard, Event.DISCARD);
});

test('Death', async t => {
    const [game, queue] = getGame({ cards: [
        { id: 'dmg', damage: 50, target: Targets.OTHER, play: Play.ACTIVATE }
    ] });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'dmg', 'P2');

    const [, deathPayload] = await queue.$find(([type]) => type === Event.DEATH);
    t.like(deathPayload, { wizard: 'P2' });

    const [, endPayload] = await queue.$find(([type]) => type === Event.END);
    t.like(endPayload, { winners: ['P1'] });
});

test('Calculations based on power-level', async t => {
    const [game, queue] = getGame({
        config: { ...Game.defaultConfig, handSize: 1 },
        cards: [
            {
                id: 'dmg',
                target: Targets.OTHER,
                play: Play.ACTIVATE,
                damage: [Calc.ADD, 1, [Calc.MUL, 5, Calc.PL]]
            },
            {
                id: 'ring',
                target: Targets.OTHER,
                play: Play.EQUIP,
                powerLevel: 1
            }
        ]
    });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'ring', 'P2');

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P2', 'dmg', 'P1');

    const [, stat] = await queue.$find(([type]) => type === Event.STAT);
    t.like(stat, { hitPoints: -11 });
});

test('Calculations based on hp', async t => {
    const [game, queue] = getGame({
        config: { ...Game.defaultConfig, handSize: 1 },
        cards: [
            {
                id: 'dmgHalfSelf',
                target: Targets.SELF,
                play: Play.ACTIVATE,
                damage: [Calc.MUL, 0.5, Calc.HP]
            },
            {
                id: 'dmgHalfTarget',
                target: Targets.OTHER,
                play: Play.ACTIVATE,
                damage: [Calc.MUL, 0.5, [Calc.HP, Calc.TARGET]]
            }
        ]
    });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'dmgHalfTarget', 'P2');

    const [, statHalfTarget] = await queue.$find(([type]) => type === Event.STAT);
    t.like(statHalfTarget, { hitPoints: -25 });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P2', 'dmgHalfSelf', Zone.UNSPECIFIED);

    const [, statHalfSelf] = await queue.$find(([type]) => type === Event.STAT);
    t.like(statHalfSelf, { hitPoints: -13 });
});

test('Calculations with rolls', async t => {
    const [game, queue] = getGame({
        config: { ...Game.defaultConfig, handSize: 1 },
        cards: [
            {
                id: 'dmg',
                target: Targets.OTHER,
                play: Play.ACTIVATE,
                damage: [Calc.ROLL, 3, 6]
            }
        ]
    });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'dmg', 'P2');

    const [, stat] = await queue.$find(([type]) => type === Event.STAT);
    t.like(stat, { hitPoints: -11 });
});

test('Heal', async t => {
    const [game, queue] = getGame({ cards: [
        { id: 'heal', heal: 5, target: Targets.OTHER, play: Play.ACTIVATE }
    ] });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'heal', 'P2');

    const [, stat] = await queue.$find(([type]) => type === Event.STAT);
    t.like(stat, { hitPoints: 5 });
});

test('Saves', async t => {
    const diceRolls = [5, 5, 15];
    const rng = { ...baseArgs.rng, dice: diceRolls.shift.bind(diceRolls) };
    const [game, queue] = getGame({
        rng,
        cards: [
            { id: 'dmg1', damage: 5, canSave: true, target: Targets.OTHER, play: Play.ACTIVATE },
            { id: 'dmg2', damage: 5, canSave: 0.5, target: Targets.OTHER, play: Play.ACTIVATE },
            { id: 'dmg3', damage: 5, canSave: true, target: Targets.OTHER, play: Play.ACTIVATE }
        ]
    });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'dmg1', 'P2');

    const [[activate1], [save1, save1Payload], [dmg1, dmg1Payload]] = await queue.$dequeue(3);

    t.is(activate1, Event.ACTIVATE);
    t.is(save1, Event.SAVE);
    t.like(save1Payload, { wizard: 'P1', targets: ['P2'] });
    t.is(dmg1, Event.STAT);
    t.like(dmg1Payload, { wizard: 'P2', hitPoints: -0 });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'dmg2', 'P2');

    const [, dmg2] = await queue.$find(([type]) => type === Event.STAT);
    t.like(dmg2, { hitPoints: -3 });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'dmg3', 'P2');

    const [, dmg3] = await queue.$find(([type]) => type === Event.STAT);
    t.like(dmg3, { hitPoints: -5 });
});

test('Resists', async t => {
    const [game, queue] = getGame({
        config: { ...Game.defaultConfig, handSize: 1 },
        cards: [
            { id: 'resist', savingThrow: Calc.PL, target: Targets.SELF, react: Play.EFFECT },
            { id: 'dmg', damage: 5, canSave: true, canResist: true, target: Targets.OTHER, play: Play.ACTIVATE }
        ]
    });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'dmg', 'P2');

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P2', 'resist', Zone.UNSPECIFIED);

    const [
        [resist, resistPayload],
        [save, savePayload],
        [dmg, dmgPayload]
    ] = await queue.$dequeue(3);

    t.is(resist, Event.AFFECT);
    t.like(resistPayload, { wizard: 'P2', card: 'resist', targets: ['P2'] });
    t.is(save, Event.SAVE);
    t.like(savePayload, { wizard: 'P1', card: 'dmg', targets: ['P2'] });
    t.is(dmg, Event.STAT);
    t.like(dmgPayload, { wizard: 'P2', hitPoints: -0 });
});

test('Cancels', async t => {
    const [game, queue] = getGame({
        config: { ...Game.defaultConfig, handSize: 3 },
        cards: [
            { id: 'dmg3', damage: 5, canCancel: 2, target: Targets.OTHER, play: Play.ACTIVATE },
            { id: 'cancel4', cancel: true },
            { id: 'cancel3', cancel: true },
            { id: 'dmg2', damage: 5, canCancel: 2, target: Targets.OTHER, play: Play.ACTIVATE },
            { id: 'cancel2', cancel: true },
            { id: 'cancel1', cancel: true },
            { id: 'dmg1', damage: 5, canCancel: true, target: Targets.OTHER, play: Play.ACTIVATE },
        ]
    });

    // A card requiring a single cancel
    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'dmg1', 'P2');

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P2', 'cancel3');

    const [
        [cancel],
        [discardCancel, discardCancelPayload],
        [discardDmg, discardDmgPayload]
    ] = await queue.$dequeue(3);

    t.is(cancel, Event.CANCEL);
    t.is(discardCancel, Event.DISCARD);
    t.like(discardCancelPayload, { wizard: 'P2', card: 'cancel3' });
    t.is(discardDmg, Event.DISCARD);
    t.like(discardDmgPayload, { wizard: 'P1', card: 'dmg1' });

    // A card requiring two cancels met with two cancel cards.
    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P2', 'dmg2', 'P1');

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'cancel1');

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'cancel2');

    const [
        [cancel2],
        [discardCancel2, discardCancel2Payload],
        [discardCancel3, discardCancel3Payload],
        [discardDmg2, discardDmg2Payload]
    ] = await queue.$dequeue(4);

    t.is(cancel2, Event.CANCEL);
    t.is(discardCancel2, Event.DISCARD);
    t.like(discardCancel2Payload, { wizard: 'P1', card: 'cancel1' });
    t.is(discardCancel3, Event.DISCARD);
    t.like(discardCancel3Payload, { wizard: 'P1', card: 'cancel2' });
    t.is(discardDmg2, Event.DISCARD);
    t.like(discardDmg2Payload, { wizard: 'P2', card: 'dmg2' });

    // A card requiring two cancels met with a single cancel card.
    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'dmg3', 'P2');

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P2', 'cancel4');

    const [[damage, damagePayload], [discard]] = await queue.$dequeue(3);

    t.is(damage, Event.STAT);
    t.like(damagePayload, { wizard: 'P2', hitPoints: -5 });
    t.is(discard, Event.DISCARD);
});

test.todo('Redirects');

test.todo('Acid'/*, async t => {
    const [game, queue] = getGame({
        config: { ...Game.defaultConfig, handSize: 1 },
        cards: [
            { id: 'item', target: Targets.SELF, play: Play.EQUIP },
            { id: 'acid', damage: 1, acid: true, target: Targets.OTHER, play: Play.ACTIVATE }
        ]
    });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'item', Zone.UNSPECIFIED);

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P2', 'acid', 'P1');

    const [
        []
    ]

    const [, stat] = await queue.$find(([type]) => type === Event.STAT);
    t.like(stat, { hitPoints: 5 });
}*/);

test.todo('Lifesteal');

test.todo('Sacrifice');

test.todo('Untargettable');

test.todo('Reveal');

test.todo('Transfer body');

test.todo('Haste');

test.todo('Inactive');

test.todo('Resurrect');

test.todo('Absorb');

test.todo('Saving throw bonuses');

test.todo('Power level bonuses');

test.todo('Counter');

test.todo('Card types');
