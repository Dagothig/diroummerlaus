const test = require('ava');
const {
    Game,
    cards,
    definitions: { Card, Event, Calc, Targets, Play, Zone, Item }
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

test('Invalid action', async t => {
    const [game, queue] = getGame({
        config: { handSize: 1 },
        cards: [
            { id: 'b' },
            { id: 'a' },
        ]
    });

    // P1 doesn't have the 'b' card in hand, so this should be ignored.
    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'b', Zone.TALON);

    // P1 *has* to play a card, so this should be ignored.
    game.send('P1');

    // It isn't P2's turn, so this should be ignored.
    game.send('P2', 'b', Zone.TALON);

    t.like(game.wizards.find(w => w.player === 'P1').hand[0], { id: 'a' });
    t.like(game.wizards.find(w => w.player === 'P2').hand[0], { id: 'b' });
});

test('Play card types', async t => {
    const cards = [
        { id: 'play', play: Play.ACTIVATE, target: Targets.SELF },
        { id: 'effect', play: Play.EFFECT, target: Targets.SELF },
        { id: 'equip', play: Play.EQUIP, target: Targets.SELF }
    ];

    const [game, queue] = getGame({ cards });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'play', 'P1');

    const [[activate, activatePayload], [discard, discardPayload]] = await queue.$dequeue(2);
    t.is(activate, Event.ACTIVATE);
    t.like(activatePayload, { wizard: 'P1', card: 'play', targets: ['P1'] });
    t.is(discard, Event.DISCARD);
    t.like(discardPayload, { wizard: 'P1', card: 'play' });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'effect', 'P1');

    const [[effect, effectPayload]] = await queue.$dequeue();
    t.is(effect, Event.EFFECT);
    t.like(effectPayload, { wizard: 'P1', card: 'effect', targets: ['P1'] });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'equip', 'P1');

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
            ['self', ['P1', Zone.TALON]],
            ['other', ['P2', 'P3', Zone.TALON]],
            ['others', [Zone.UNSPECIFIED, Zone.TALON]],
            ['left', ['P2', Zone.TALON]],
            ['right', ['P3', Zone.TALON]]
        ]
    });

    game.send('P1', 'self', 'P1');

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
    game.send('P1', 'left', 'P2');

    const [[, leftp]] = await queue.$dequeue();
    t.like(leftp, { wizard: 'P1', card: 'left', targets: ['P2'] });

    // Right
    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'right', 'P3');

    const [[, rightp]] = await queue.$dequeue();
    t.like(rightp, { wizard: 'P1', card: 'right', targets: ['P3'] });
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
    const [game, queue] = getGame({
        config: { handSize: 1 },
        cards: [
            { id: 'deadweight' },
            { id: 'dmg', damage: 50, target: Targets.OTHER, play: Play.ACTIVATE }
        ]
    });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'dmg', 'P2');

    // Skip the dmg card discard.
    await queue.$find(([type]) => type === Event.DISCARD);

    const [, discardPayload] = await queue.$find(([type]) => type === Event.DISCARD);
    t.like(discardPayload, { wizard: 'P2', card: 'deadweight' });

    const [, deathPayload] = await queue.$find(([type]) => type === Event.DEATH);
    t.like(deathPayload, { wizard: 'P2' });

    const [, endPayload] = await queue.$find(([type]) => type === Event.END);
    t.like(endPayload, { winners: ['P1'] });
});

test('Calculations cases', async t => {
    const [game, queue] = getGame({
        config: { handSize: 1 },
        cards: [
            { id: 'unknown', type: Card.AD, damage: Symbol("WO") },
            { id: 'caster', type: Card.AD, damage: [Calc.MUL, [Calc.HP, Calc.CASTER], 0.5] },
            { id: 'dmgArray', type: Card.AD, damage: [6] },
            { id: 'dmgEmptyMul', type: Card.AD, damage: [Calc.MUL] },
        ]
    })

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'dmgEmptyMul', 'P2');

    const [, stat1p] = await queue.$find(([type]) => type === Event.STAT);
    t.like(stat1p, { wizard: 'P2', hitPoints: -1 });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P2', 'dmgArray', 'P1');

    const [, stat2p] = await queue.$find(([type]) => type === Event.STAT);
    t.like(stat2p, { wizard: 'P1', hitPoints: -6});

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'caster', 'P2');

    const [, stat3p] = await queue.$find(([type]) => type === Event.STAT);
    t.like(stat3p, { wizard: 'P2', hitPoints: -22 });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P2', 'unknown', 'P1');

    const [, stat4p] = await queue.$find(([type]) => type === Event.STAT);
    t.like(stat4p, { wizard: 'P1', hitPoints: 0 });
});

test('Calculations based on power-level', async t => {
    const [game, queue] = getGame({
        config: { handSize: 1 },
        cards: [
            {
                id: 'dmg',
                target: Targets.OTHER,
                play: Play.ACTIVATE,
                damage: [Calc.ADD, 1, [Calc.MUL, 5, [Calc.PL, Calc.TARGET]]]
            },
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
    t.like(stat, { wizard: 'P1', hitPoints: -11 });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'dmg', 'P2');

    const [, stat2] = await queue.$find(([type]) => type === Event.STAT);
    t.like(stat2, { wizard: 'P2', hitPoints: -11 });
});

test('Calculations based on hp', async t => {
    const [game, queue] = getGame({
        config: { handSize: 1 },
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
    game.send('P2', 'dmgHalfSelf', 'P2');

    const [, statHalfSelf] = await queue.$find(([type]) => type === Event.STAT);
    t.like(statHalfSelf, { hitPoints: -13 });
});

test('Calculations with rolls', async t => {
    const [game, queue] = getGame({
        config: { handSize: 1 },
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

test('Calculations with choice', async t => {
    const [game, queue] = getGame({
        cards: [
            { id: 'choose', target: Targets.OTHER, play: Play.ACTIVATE, damage: [Calc.CHOOSE, 100] }
        ]
    });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'choose', 'P2');

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 50);

    const [[, stat]] = await queue.$dequeue(1);
    t.like(stat, { hitPoints: -50 });
});

test('Calculations based on number of players alive', async t => {
    const [game, queue] = getGame({
        cards: [
            { id: 'alive', target: Targets.OTHER, play: Play.ACTIVATE, damage: Calc.ALIVE }
        ]
    });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'alive', 'P2');

    const [, [, stat]] = await queue.$dequeue(2);
    t.like(stat, { hitPoints: -2 });
});

test('Heal', async t => {
    const [game, queue] = getGame({
        config: { handSize: 1 },
        cards: [
            { id: 'heal', heal: 5, target: Targets.OTHER, play: Play.ACTIVATE },
            { id: 'damage', damage: 5, target: Targets.SELF, play: Play.ACTIVATE }
        ]
    });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'damage', 'P1');

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P2', 'heal', 'P1');

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
    t.like(dmg1Payload, { wizard: 'P2', hitPoints: 0 });

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
        config: { handSize: 1 },
        cards: [
            { id: 'resist', savingThrow: Calc.PL, target: Targets.SELF, play: Play.EFFECT, react: true },
            { id: 'dmg', damage: 5, canSave: true, canResist: true, target: Targets.OTHER, play: Play.ACTIVATE }
        ]
    });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'dmg', 'P2');

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P2', 'resist', 'P2');

    const [
        [resist, resistPayload],
        [save, savePayload],
        [dmg, dmgPayload]
    ] = await queue.$dequeue(3);

    t.is(resist, Event.EFFECT);
    t.like(resistPayload, { wizard: 'P2', card: 'resist', targets: ['P2'] });
    t.is(save, Event.SAVE);
    t.like(savePayload, { wizard: 'P1', card: 'dmg', targets: ['P2'] });
    t.is(dmg, Event.STAT);
    t.like(dmgPayload, { wizard: 'P2', hitPoints: 0 });
});

test('Reacting is optional', async t => {
    const [game, queue] = getGame({
        config: { handSize: 1 },
        cards: [
            { id: 'resist', react: true },
            { id: 'dmg', type: Card.AD, damage: 5, canResist: true }
        ]
    });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'dmg', 'P2');

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P2');

    const [[, statp]] = await queue.$dequeue(1);
    t.like(statp, { wizard: 'P2', hitPoints: -5 });
});

test('Cancels', async t => {
    const [game, queue] = getGame({
        config: { handSize: 3 },
        cards: [
            { id: 'dmg3', damage: 5, canCancel: 2, type: Card.AD },
            { id: 'cancel4', cancel: true },
            { id: 'cancel3', cancel: true },
            { id: 'dmg2', damage: 5, canCancel: 2, type: Card.AD },
            { id: 'cancel2', cancel: true },
            { id: 'cancel1', cancel: true },
            { id: 'dmg1', damage: 5, canCancel: true, target: Targets.OTHER, play: Play.ACTIVATE },
        ]
    });

    // A card requiring a single cancel
    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'dmg1', 'P2');

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P2', 'cancel3', Zone.UNSPECIFIED);

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
    game.send('P1', 'cancel1', Zone.UNSPECIFIED);

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'cancel2', Zone.UNSPECIFIED);

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
    game.send('P2', 'cancel4', Zone.UNSPECIFIED);

    const [[damage, damagePayload], [discard]] = await queue.$dequeue(3);

    t.is(damage, Event.STAT);
    t.like(damagePayload, { wizard: 'P2', hitPoints: -5 });
    t.is(discard, Event.DISCARD);
});

test.todo('Anybody can cancel a spell');

test.todo('Cancelling an effect may require multiple cancels');

test('Redirects', async t => {
    const [game, queue] = getGame({
        config: { handSize: 1 },
        cards: [
            { id: 'redirect', redirect: true },
            { id: 'dmg', damage: 5, canRedirect: true, target: Targets.OTHER, play: Play.ACTIVATE },
        ]
    });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'dmg', 'P2');

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P2', 'redirect', Zone.UNSPECIFIED);

    const [[discardRedirect], [damage, damagePayload], [discard]] = await queue.$dequeue(3);

    t.is(discardRedirect, Event.DISCARD);
    t.is(damage, Event.STAT);
    t.like(damagePayload, { wizard: 'P1', hitPoints: -5 });
    t.is(discard, Event.DISCARD);
});

test('Acid', async t => {
    const diceRolls = [1, 2];
    const rng = { ...baseArgs.rng, dice: diceRolls.shift.bind(diceRolls) };
    const [game, queue] = getGame({
        rng,
        config: { handSize: 1 },
        cards: [
            { id: 'acid2', damage: 1, acid: true, target: Targets.OTHER, play: Play.ACTIVATE },
            { id: 'acid1', damage: 1, acid: true, target: Targets.OTHER, play: Play.ACTIVATE },
            { id: 'item2', target: Targets.SELF, play: Play.EQUIP },
            { id: 'item1', target: Targets.SELF, play: Play.EQUIP },
        ]
    });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'item1', 'P1');

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P2', 'item2', 'P2');

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'acid1', 'P2');

    const [, stat] = await queue.$find(([type]) => type === Event.STAT);
    t.like(stat, { hitPoints: -1 });

    const [, discard] = await queue.$find(([type]) => type === Event.DISCARD);
    t.like(discard, { card: 'item2' });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P2', 'acid2', 'P1');

    const [, stat2] = await queue.$find(([type]) => type === Event.STAT);
    t.like(stat2, { hitPoints: -1 });

    // The second dice roll fails and the item is not discard,
    // and thus the next discard event is the acid2 card.
    const [, discard2] = await queue.$find(([type]) => type === Event.DISCARD);
    t.like(discard2, { card: 'acid2' });
});

test('Lifesteal', async t => {
    const [game, queue] = getGame({
        config: { handSize: 1 },
        cards: [
            { id: 'lfst', damage: 5, target: Targets.OTHER, play: Play.ACTIVATE, lifesteal: true },
            { id: 'dmg', damage: 5, target: Targets.OTHER, play: Play.ACTIVATE }
        ]
    });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'dmg', 'P2');

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P2', 'lfst', 'P1');

    const [
        [activate],
        [damage, damagePayload],
        [lifesteal, lifestealPayload],
        [discard]
    ] = await queue.$dequeue(4);

    t.is(activate, Event.ACTIVATE);
    t.is(damage, Event.STAT);
    t.like(damagePayload, { wizard: 'P1', hitPoints: -5 });
    t.is(lifesteal, Event.STAT);
    t.like(lifestealPayload, { wizard: 'P2', hitPoints: 5 });
    t.is(discard, Event.DISCARD);
});

test('Sacrifice', async t => {
    const [game, queue] = getGame({ cards: [
        { id: 'dmg', damage: Calc.SACRIFICE, target: Targets.OTHER, play: Play.ACTIVATE, sacrifice: 5 }
    ] });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'dmg', 'P2');

    const [
        [activate],
        [sacrifice, sacrificePayload],
        [damage, damagePayload],
        [discard]
    ] = await queue.$dequeue(4);

    t.is(activate, Event.ACTIVATE);
    t.is(sacrifice, Event.STAT);
    t.like(sacrificePayload, { wizard: 'P1', hitPoints: -5 });
    t.is(damage, Event.STAT);
    t.like(damagePayload, { wizard: 'P2', hitPoints: -5 });
    t.is(discard, Event.DISCARD);
});

test('Untargettable', async t => {
    const [game, queue] = getGame({
        players: ['P1', 'P2', 'P3'],
        config: { handSize: 1 },
        cards: [
            { id: 'left', play: Play.ACTIVATE, target: Targets.LEFT },
            { id: 'right', play: Play.ACTIVATE, target: Targets.RIGHT },
            { id: 'deadweight' },
            { id: 'targets', play: Play.ACTIVATE, target: Targets.OTHERS },
            { id: 'target', play: Play.ACTIVATE, target: Targets.OTHER },
            { id: 'sanctuary', play: Play.EFFECT, target: Targets.SELF, untargettable: true },
        ]
    });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'sanctuary', 'P1');

    const [, { choices: ct }] = await queue.$find(([type]) => type === Event.QUESTION);
    t.deepEqual(ct, [['target', ['P3', Zone.TALON]]]);
    game.send('P2', 'target', 'P3');

    const [, { choices: cts }] = await queue.$find(([type]) => type === Event.QUESTION);
    t.deepEqual(cts, [['targets', [Zone.UNSPECIFIED, Zone.TALON]]]);
    game.send('P3', 'targets', Zone.UNSPECIFIED);

    const [[activateCts, activateCtsPayload]] = await queue.$dequeue(1);
    t.is(activateCts, Event.ACTIVATE);
    t.like(activateCtsPayload, { targets: ['P2'] })

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'deadweight', Zone.TALON);

    const [, { choices: cr }] = await queue.$find(([type]) => type === Event.QUESTION);
    t.deepEqual(cr, [['right', [Zone.TALON]]]);
    game.send('P2', 'right', Zone.TALON);

    const [, { choices: cl }] = await queue.$find(([type]) => type === Event.QUESTION);
    t.deepEqual(cl, [['left', [Zone.TALON]]]);
    game.send('P3', 'left', Zone.TALON);
});

test('React effect', async t => {
    const diceRolls = [15, 5];
    const rng = { ...baseArgs.rng, dice: diceRolls.shift.bind(diceRolls) };
    const [game, queue] = getGame({
        rng,
        config: { handSize: 1 },
        cards: [
            { id: 'effect2', target: Targets.OTHER, play: Play.EFFECT, canSave: true },
            { id: 'effect1', target: Targets.OTHER, play: Play.EFFECT, canSave: true },
        ]
    });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'effect1', 'P2');

    const [[e1, e1p]] = await queue.$dequeue(1);

    t.is(e1, Event.EFFECT);
    t.like(e1p, { card: 'effect1', wizard: 'P1', targets: ['P2'] });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P2', 'effect2', 'P1');

    const [[e2, e2p], [save, savep]] = await queue.$dequeue(2);

    t.is(e2, Event.EFFECT);
    t.like(e2p, { card: 'effect2', wizard: 'P2', targets: ['P1'] });

    t.is(save, Event.SAVE);
    t.like(savep, { card: 'effect2', wizard: 'P2' });
});

test.todo('Reveal');

test('Transfer body', async t => {
    const [game, queue] = getGame({
        config: { handSize: 1 },
        cards: [
            { id: 'deadweight1' },
            { id: 'deadweight2' },
            { id: 'transfer', transferBodies: true, target: Targets.OTHER, play: Play.ACTIVATE }
        ]
    });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'transfer', 'P2');

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'deadweight2', Zone.TALON);

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P2', 'deadweight1', Zone.TALON);

    t.pass();
});

test('Haste', async t => {
    const [game, queue] = getGame({
        config: { handSize: 3 },
        cards: [
            { id: 'deadweight' },
            { id: 'b', play: Play.ACTIVATE, target: Targets.OTHER },
            { id: 'a', play: Play.ACTIVATE, target: Targets.OTHER },
            { id: 'haste', haste: 2, play: Play.ACTIVATE, target: Targets.SELF }
        ]
    });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'haste', 'P1');

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'a', 'P2');

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'b', 'P2');

    t.pass();
});

test('Combo', async t => {
    const [game, queue] = getGame({
        config: { handSize: 3 },
        players: ['P1', 'P2', 'P3'],
        cards: [
            { id: 'deadweight' },
            { id: 'dmg', type: Card.AD, damage: 1 },
            {
                id: 'othercombo',
                play: Play.ACTIVATE,
                target: Targets.OTHER,
                combo: { count: 1 }
            },
            { id: 'deadweight', type: Card.AD },
            { id: 'dmg', type: Card.AD, damage: 1 },
            {
                id: 'combo',
                play: Play.ACTIVATE,
                target: Targets.OTHER,
                combo: { count: 1, type: Card.AD, multiplier: 2 }
            }
        ]
    });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'combo', 'P2');

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'dmg');

    const [, statp] = await queue.$find(([type]) => type === Event.STAT);
    t.like(statp, { wizard: 'P2', hitPoints: -2 });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P2', 'othercombo', 'P1');

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P2', 'dmg');

    const [, stat2p] = await queue.$find(([type]) => type === Event.STAT);
    t.like(stat2p, { wizard: 'P1', hitPoints: -1 });
});

test('Inactive', async t => {
    const [game, queue] = getGame({
        config: { handSize: 1 },
        cards: [
            { id: 'deadweight' },
            { id: 'dmg', play: Play.ACTIVATE, target: Targets.OTHER, canSave: true, savingThrow: 20, damage: 1 },
            { id: 'otherCard', play: Play.ACTIVATE, target: Targets.OTHER },
            { id: 'inactive', play: Play.EFFECT, target: Targets.OTHER, inactive: true }
        ]
    });

    const [, t1p] = await queue.$find(([type]) => type === Event.TURN);
    t.like(t1p, { wizard: 'P1' });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'inactive', 'P2');

    const [, t2p] = await queue.$find(([type]) => type === Event.TURN);
    t.like(t2p, { wizard: 'P2' });

    const [, t3p] = await queue.$find(([type]) => type === Event.TURN);
    t.like(t3p, { wizard: 'P1' });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'dmg', 'P2');

    // P2 cannot save because they are inactive.
    const [[activate], [dmg, dmgPayload]] = await queue.$dequeue(2);

    t.is(activate, Event.ACTIVATE);

    t.is(dmg, Event.STAT);
    t.like(dmgPayload, { wizard: 'P2', hitPoints: -1 });
});

test('Resurrect', async t => {
    const [game, queue] = getGame({
        config: { handSize: 1 },
        cards: [
            { id: 'drawnDeadweight' },
            { id: 'discardedDeadweight' },
            { id: 'dmg', type: Card.AD, damage: 50 },
            { id: 'resurrectionRing', type: Card.O, item: Item.RING, resurrect: true }
        ]
    });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'resurrectionRing', 'P1');

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P2', 'dmg', 'P1');

    const [
        , // Activate
        , // Damage
        , // Discard damage
        [resurrect, resurrectPayload],
        [d1, d1Payload],
        [d2, d2Payload],
        [draw, drawPayload]
    ] = await queue.$dequeue(7);

    t.is(resurrect, Event.STAT);
    t.like(resurrectPayload, { wizard: 'P1', hitPoints: 50 });

    t.is(d1, Event.DISCARD);
    t.like(d1Payload, { wizard: 'P1', card: 'discardedDeadweight' });

    t.is(d2, Event.DISCARD);
    t.like(d2Payload, { wizard: 'P1', card: 'resurrectionRing' });

    t.is(draw, Event.DRAW);
    t.like(drawPayload, { wizard: 'P1', cards: ['drawnDeadweight'] });
});

test('Absorb', async t => {
    const [game, queue] = getGame({
        config: { handSize: 1 },
        cards: [
            { id: 'dmg', type: Card.AD, damage: 10 },
            { id: 'absorb', type: Card.O, absorb: 5 },
        ]
    });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'absorb', 'P1');

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P2', 'dmg', 'P1');

    const [, statp] = await queue.$find(([type]) => type === Event.STAT);
    t.like(statp, { wizard: 'P1', hitPoints: -5 });
});

test('Counter', async t => {
    const [game, queue] = getGame({
        config: { handSize: 1 },
        cards: [
            { id: 'deadweight' },
            { id: 'deadweight' },
            { id: 'counter', play: Play.EFFECT, target: Targets.SELF, counter: 1 },
        ]
    });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'counter', 'P1');

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P2', 'deadweight', Zone.TALON);

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'deadweight', Zone.TALON);

    const [, [effectDiscard, effectDiscardP]] = await queue.$dequeue(2);

    t.is(effectDiscard, Event.DISCARD);
    t.like(effectDiscardP, { wizard: 'P1', card: 'counter' });
});

const deadweight = { id: 'deadweight' };
const handObject = { id: 'handObject', type: Card.O };
const handEffect = { id: 'handEffect', play: Play.EFFECT, target: Targets.SELF };
const handSpell = { id: 'handSpell' };
const effect = { id: 'effect', play: Play.EFFECT, target: Targets.SELF };
const ring1 = { id: 'ring1', type: Card.O, item: Item.RING };
const ring2 = { id: 'ring2', type: Card.O, item: Item.RING };
const robe = { id: 'robe', type: Card.O, item: Item.ROBE };
for (const [card, answer, expectedDiscard] of [
    [
        { id: 'depouillement', type: Card.CO, remove: Item.EQUIPPED },
        [],
        [ring1, ring2, robe]
    ],
    [
        { id: 'dissipationAnneau', type: Card.CO, remove: [Item.CHOOSE, [Item.RING, Item.EQUIPPED]] },
        ['P1', 'ring1'],
        [ring1]
    ],
    [
        { id: 'all', type: Card.CO, remove: Item.ALL },
        [],
        [handObject, handEffect, handSpell, ring1, ring2, robe, effect]
    ],
    [
        { id: 'intervention', type: Card.CO, remove: [Item.EXCEPT, Item.ALL, Item.CHOOSE] },
        ['P1', 'ring1'],
        [handObject, handEffect, handSpell, ring2, robe, effect]
    ],
    [
        { id: 'rings and robes', type: Card.CO, remove: [Item.ALL, Item.RING, Item.ROBE] },
        [],
        [ring1, ring2, robe]
    ],
    [{ id: 'unknown', type: Card.CO, remove: 12 }, [], []],
    [{ id: 'unknown', type: Card.CO, remove: Symbol('unknown') }, [], []]
]) {
    const removeStr = String.expr(card.remove);
    const discardsStr = expectedDiscard.map(c => c.id).join(', ');
    test(`Remove ${ removeStr } discards ${ discardsStr }`, async t => {
        const [game, queue] = getGame({
            config: { handSize: 7 },
            cards: [
                handObject, handEffect, handSpell, effect, ring1, ring2, robe,
                deadweight, deadweight, deadweight, deadweight, deadweight, deadweight, card,
            ]
        });

        for (const item of [effect, ring1, ring2, robe]) {
            await queue.$find(([type]) => type === Event.QUESTION);
            game.send('P1', 'deadweight', Zone.TALON);

            await queue.$find(([type]) => type === Event.QUESTION);
            game.send('P2', item.id, 'P2');
        }

        await queue.$find(([type]) => type === Event.QUESTION);
        game.send('P1', card.id, 'P2');

        if (answer.length) {
            await queue.$find(([type]) => type === Event.QUESTION);
            game.send(...answer);
        }

        for (const discardedItem of expectedDiscard) {
            const [, payload] = await queue.$find(([type]) => type === Event.DISCARD);
            t.like(payload, { wizard: 'P2', card: discardedItem.id });
        }

        t.pass();
    });
}

test('Steal', async t => {
    const [game, queue] = getGame({
        config: { handSize: 1 },
        cards: [
            { id: 'steal', type: Card.CO, steal: [Item.CHOOSE, Item.EQUIPPED] },
            ring1,
        ]
    });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'ring1', 'P1');

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P2', 'steal', 'P1');

    const [, stealPayload] = await queue.$find(([type]) => type === Event.STEAL);
    t.like(stealPayload, { wizard: 'P2', targets: ['P1'], card: 'ring1' });
});

test('Multi', async t => {
    const [game, queue] = getGame({
        players: ['P1', 'P2', 'P3'],
        config: { handSize: 3 },
        cards: [
            ...Array.gen(6, i => ({ id: `deadweight${ 6 - i }` })),
            {
                id: 'withSameTarget',
                type: Card.AD,
                multi: [
                    { damage: 1 },
                    { damage: 1 }
                ]
            },
            {
                id: 'withImplicitTargets',
                play: Play.ACTIVATE,
                target: Targets.SELF,
                multi: [
                    { damage: 1, target: Targets.LEFT },
                    { damage: 1, target: Targets.RIGHT }
                ]
            },
            {
                id: 'withIndividualSaves',
                type: Card.AD,
                multi: [
                    { damage: 1, canSave: true },
                    { damage: 1, canSave: true, savingThrow: 20 }
                ]
            }
        ]
    });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'withSameTarget', 'P2');

    const [, d1p] = await queue.$find(([type]) => type === Event.STAT);
    const [, d2p] = await queue.$find(([type]) => type === Event.STAT);
    t.like(d1p, { wizard: 'P2', hitPoints: -1 });
    t.like(d2p, { wizard: 'P2', hitPoints: -1 });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P2', 'deadweight1', Zone.TALON);

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P3', 'deadweight4', Zone.TALON);

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'withImplicitTargets', 'P1');

    const [, d3p] = await queue.$find(([type]) => type === Event.STAT);
    const [, d4p] = await queue.$find(([type]) => type === Event.STAT);
    t.like(d3p, { wizard: 'P2', hitPoints: -1 });
    t.like(d4p, { wizard: 'P3', hitPoints: -1 });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P2', 'deadweight2', Zone.TALON);

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P3', 'deadweight5', Zone.TALON);

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'withIndividualSaves', 'P2');

    const [, d5p] = await queue.$find(([type]) => type === Event.STAT);
    const [, sp] = await queue.$find(([type]) => type === Event.SAVE);
    t.like(d5p, { wizard: 'P2', hitPoints: -1 });
    t.like(sp, { wizard: 'P1', targets: ['P2'] });
});

test('Desintegrate', async t => {
    const [game, queue] = getGame({ cards: [
        { id: 'kill', type: Card.AD, desintegrate: true }
    ] });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'kill', 'P2');

    const [, deathPayload] = await queue.$find(([type]) => type === Event.DEATH);
    t.like(deathPayload, { wizard: 'P2' });
});

test('Reshuffle', async t => {
    const [game, queue] = getGame({
        config: { handSize: 1 },
        cards: [
            { id: 'reshuffle', play: Play.ACTIVATE, reshuffle: true, target: Targets.OTHERS },
            ...Array.gen(2, i => ({ id: 'deadweight' + (2 - i) }))
        ]
    });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'deadweight1', Zone.TALON);

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P2', 'deadweight2', Zone.TALON);

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'reshuffle', Zone.UNSPECIFIED);

    const [, [reshuffle, reshufflePayload]] = await queue.$dequeue(2);

    t.is(reshuffle, Event.RESHUFFLE);
    t.like(reshufflePayload, { cards: ['deadweight1', 'deadweight2'] });

    // At P2's turn there were no cards to draw so it's P1's turn again.
    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'deadweight2', Zone.TALON);

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P2', 'deadweight1', Zone.TALON);
});

test('Equip caps', async t => {
    const [game, queue] = getGame({
        config: { handSize: 3 },
        cards: [
            ...Array.gen(2, i => ({ id: 'robe' + (2 - i), type: Card.O, item: Item.ROBE })),
            ...Array.gen(3, i => ({ id: 'ring' + (3 - i), type: Card.O, item: Item.RING }))
        ]
    });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'ring1', 'P1');

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P2', 'robe1', 'P2');

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'ring2', 'P1');

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P2', 'robe2', 'P2');

    const [[, discardRobe]] = await queue.$dequeue(1);
    t.like(discardRobe, { wizard: 'P2', card: 'robe1' });

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'ring3', 'P1');

    await queue.$find(([type]) => type === Event.QUESTION);
    game.send('P1', 'ring1');
    const [[, discardRing]] = await queue.$dequeue(1);
    t.like(discardRing, { wizard: 'P1', card: 'ring1' });
});
