const test = require('ava');
const {
    Game,
    definitions: { Card, Event, Calc, Targets, Play, Zone, Item }
} = require('.');
const GameQueue = require('./GameQueue');

const baseArgs = {
    players: ['P1', 'P2'],
    rng: {
        shuffle: Function.id,
        dice: (amount, sides) => amount * (1 + sides) / 2
    },
    cards: []
};

function getGame(args) {
    const g = new Game({ ...baseArgs, ...args });
    const q = new GameQueue(g);
    const $run = g.$run();

    return [g, q, $run];
}

test('Base turn', async t => {
    const [g, q] = getGame({ cards: Array.gen(11, i => ({ id: i })) });

    const [
        [drawP1, drawP1Payload],
        [drawP2, drawP2Payload],
        [turn, turnPayload],
        [question, questionPayload]
    ] = await q.$dequeue(4);

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

    g.send('P1', 6, Zone.TALON);

    const [
        [discard, discardPayload],
        [drawMissing, drawMissingPayload],
        [newTurn, newTurnPayload]
    ] = await q.$dequeue(3);

    t.is(discard, Event.DISCARD);
    t.like(discardPayload, { wizard: 'P1', card: 6 });

    t.is(drawMissing, Event.DRAW);
    t.like(drawMissingPayload, { wizard: 'P1', cards: [0] });

    t.is(newTurn, Event.TURN);
    t.like(newTurnPayload, { wizard: 'P2' });
});

test('Invalid action', async t => {
    const [g, q] = getGame({
        config: { handSize: 1 },
        cards: [{ id: 'b' }, { id: 'a' }]
    });

    // P1 doesn't have the 'b' card in hand, so this should be ignored.
    await q.$type(Event.QUESTION);
    g.send('P1', 'b', Zone.TALON);

    // P1 *has* to play a card, so this should be ignored.
    g.send('P1');

    // It isn't P2's turn, so this should be ignored.
    g.send('P2', 'b', Zone.TALON);

    t.like(g.wizards.find(w => w.player === 'P1').hand[0], { id: 'a' });
    t.like(g.wizards.find(w => w.player === 'P2').hand[0], { id: 'b' });
});

test('Play card types', async t => {
    const cards = [
        { id: 'play', type: Card.A },
        { id: 'effect', play: Play.EFFECT, target: Targets.SELF },
        { id: 'equip', play: Play.EQUIP, target: Targets.SELF }
    ];

    const [g, q] = getGame({ cards });

    await q.$type(Event.QUESTION);
    g.send('P1', 'play', 'P1');

    const [[activate, activatePayload], [discard, discardPayload]] = await q.$dequeue(2);
    t.is(activate, Event.ACTIVATE);
    t.like(activatePayload, { wizard: 'P1', card: 'play', targets: ['P1'] });
    t.is(discard, Event.DISCARD);
    t.like(discardPayload, { wizard: 'P1', card: 'play' });

    await q.$type(Event.QUESTION);
    g.send('P1', 'effect', 'P1');

    const [[effect, effectPayload]] = await q.$dequeue();
    t.is(effect, Event.EFFECT);
    t.like(effectPayload, { wizard: 'P1', card: 'effect', targets: ['P1'] });

    await q.$type(Event.QUESTION);
    g.send('P1', 'equip', 'P1');

    const [[equip, equipPayload]] = await q.$dequeue();
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

    const [g, q] = getGame({ cards, players: [...baseArgs.players, 'P3'] });

    // Self
    const q1p = await q.$type(Event.QUESTION);
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

    g.send('P1', 'self', 'P1');

    const [[self, selfp]] = await q.$dequeue();
    t.is(self, Event.EQUIP);
    t.like(selfp, { wizard: 'P1', card: 'self', targets: ['P1'] });

    // Other
    await q.$type(Event.QUESTION);
    g.send('P1', 'other', 'P2');

    const [[, otherp]] = await q.$dequeue();
    t.like(otherp, { wizard: 'P1', card: 'other', targets: ['P2'] });

    // Others
    await q.$type(Event.QUESTION);
    g.send('P1', 'others', Zone.UNSPECIFIED);

    const [[, othersp]] = await q.$dequeue();
    t.like(othersp, { wizard: 'P1', card: 'others', targets: ['P2', 'P3'] });

    // Left
    await q.$type(Event.QUESTION);
    g.send('P1', 'left', 'P2');

    const [[, leftp]] = await q.$dequeue();
    t.like(leftp, { wizard: 'P1', card: 'left', targets: ['P2'] });

    // Right
    await q.$type(Event.QUESTION);
    g.send('P1', 'right', 'P3');

    const [[, rightp]] = await q.$dequeue();
    t.like(rightp, { wizard: 'P1', card: 'right', targets: ['P3'] });
});

test('Damage', async t => {
    const [g, q] = getGame({ cards: [
        { id: 'dmg', damage: 5, type: Card.AD }
    ] });

    await q.$type(Event.QUESTION);
    g.send('P1', 'dmg', 'P2');

    const [[activate], [damage, damagePayload], [discard]] = await q.$dequeue(3);

    t.is(activate, Event.ACTIVATE);
    t.is(damage, Event.STAT);
    t.like(damagePayload, { wizard: 'P2', hitPoints: -5 });
    t.is(discard, Event.DISCARD);
});

test('Death', async t => {
    const [g, q] = getGame({
        config: { handSize: 1 },
        cards: [
            { id: 'deadweight' },
            { id: 'dmg', damage: 50, type: Card.AD }
        ]
    });

    await q.$type(Event.QUESTION);
    g.send('P1', 'dmg', 'P2');

    // Skip the dmg card discard.
    await q.$type(Event.DISCARD);

    t.like(await q.$type(Event.DISCARD), { wizard: 'P2', card: 'deadweight' });
    t.like(await q.$type(Event.DEATH), { wizard: 'P2' });
    t.like(await q.$type(Event.END), { winners: ['P1'] });
});

test('Calculations cases', async t => {
    const [, q] = getGame({
        config: { handSize: 1 },
        cards: [
            { id: 'unknown', type: Card.AD, damage: Symbol("WO") },
            { id: 'caster', type: Card.AD, damage: [Calc.MUL, [Calc.HP, Calc.CASTER], 0.5] },
            { id: 'dmgArray', type: Card.AD, damage: [6] },
            { id: 'dmgEmptyMul', type: Card.AD, damage: [Calc.MUL] },
        ]
    });

    await q.$answer('P1', 'dmgEmptyMul', 'P2');
    t.like(await q.$type(Event.STAT), { wizard: 'P2', hitPoints: -1 });

    await q.$answer('P2', 'dmgArray', 'P1');
    t.like(await q.$type(Event.STAT), { wizard: 'P1', hitPoints: -6});

    await q.$answer('P1', 'caster', 'P2');
    t.like(await q.$type(Event.STAT), { wizard: 'P2', hitPoints: -22 });

    await q.$answer('P2', 'unknown', 'P1');
    t.like(await q.$type(Event.STAT), { wizard: 'P1', hitPoints: 0 });
});

test('Calculations based on power-level', async t => {
    const [, q] = getGame({
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

    await q.$answer('P1', 'ring', 'P2');
    await q.$answer('P2', 'dmg', 'P1');
    t.like(await q.$type(Event.STAT), { wizard: 'P1', hitPoints: -11 });

    await q.$answer('P1', 'dmg', 'P2');
    t.like(await q.$type(Event.STAT), { wizard: 'P2', hitPoints: -11 });
});

test('Calculations based on hp', async t => {
    const [, q] = getGame({
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

    await q.$answer('P1', 'dmgHalfTarget', 'P2');
    t.like(await q.$type(Event.STAT), { hitPoints: -25 });

    await q.$answer('P2', 'dmgHalfSelf', 'P2');
    t.like(await q.$type(Event.STAT), { hitPoints: -13 });
});

test('Calculations with rolls', async t => {
    const [, q] = getGame({
        config: { handSize: 1 },
        cards: [{ id: 'dmg', type: Card.AD, damage: [Calc.ROLL, 3, 6] }]
    });

    await q.$answer('P1', 'dmg', 'P2');
    t.like(await q.$type(Event.STAT), { hitPoints: -11 });
});

test('Calculations with choice', async t => {
    const [, q] = getGame({
        cards: [{ id: 'choose', type: Card.AD, damage: [Calc.CHOOSE, 100] }]
    });

    await q.$answer('P1', 'choose', 'P2');
    await q.$answer('P1', 50);
    t.like(await q.$type(Event.STAT), { hitPoints: -50 });
});

test('Calculations based on number of players alive', async t => {
    const [, q] = getGame({
        cards: [{ id: 'alive', type: Card.AD, damage: Calc.ALIVE }]
    });

    await q.$answer('P1', 'alive', 'P2');
    t.like(await q.$type(Event.STAT), { hitPoints: -2 });
});

test('Heal', async t => {
    const [, q] = getGame({
        config: { handSize: 1 },
        cards: [{ id: 'heal', heal: 5, type: Card.AD }, { id: 'damage', damage: 5, type: Card.A }]
    });

    await q.$answer('P1', 'damage', 'P1');
    await q.$answer('P2', 'heal', 'P1');
    t.like(await q.$type(Event.STAT), { hitPoints: 5 });
});

test('Saves', async t => {
    const diceRolls = [5, 5, 15];
    const rng = { ...baseArgs.rng, dice: diceRolls.shift.bind(diceRolls) };
    const [, q] = getGame({
        rng,
        cards: [
            { id: 'dmg1', damage: 5, canSave: true, type: Card.AD },
            { id: 'dmg2', damage: 5, canSave: 0.5, type: Card.AD },
            { id: 'dmg3', damage: 5, canSave: true, type: Card.AD }
        ]
    });

    await q.$answer('P1', 'dmg1', 'P2');

    const [[activate1], [save1, save1Payload], [dmg1, dmg1Payload]] = await q.$dequeue(3);

    t.is(activate1, Event.ACTIVATE);
    t.is(save1, Event.SAVE);
    t.like(save1Payload, { wizard: 'P1', targets: ['P2'] });
    t.is(dmg1, Event.STAT);
    t.like(dmg1Payload, { wizard: 'P2', hitPoints: 0 });

    await q.$answer('P1', 'dmg2', 'P2');
    t.like(await q.$type(Event.STAT), { hitPoints: -3 });

    await q.$answer('P1', 'dmg3', 'P2');
    t.like(await q.$type(Event.STAT), { hitPoints: -5 });
});

test('Resists', async t => {
    const [, q] = getGame({
        config: { handSize: 1 },
        cards: [
            { id: 'resist', savingThrow: Calc.PL, target: Targets.SELF, play: Play.EFFECT, react: true },
            { id: 'dmg', damage: 5, canSave: true, canResist: true, type: Card.AD }
        ]
    });

    await q.$answer('P1', 'dmg', 'P2');
    await q.$answer('P2', 'resist', 'P2');

    const [
        [resist, resistPayload],
        [save, savePayload],
        [dmg, dmgPayload]
    ] = await q.$dequeue(3);

    t.is(resist, Event.EFFECT);
    t.like(resistPayload, { wizard: 'P2', card: 'resist', targets: ['P2'] });
    t.is(save, Event.SAVE);
    t.like(savePayload, { wizard: 'P1', card: 'dmg', targets: ['P2'] });
    t.is(dmg, Event.STAT);
    t.like(dmgPayload, { wizard: 'P2', hitPoints: 0 });
});

test('Reacting is optional', async t => {
    const [, q] = getGame({
        config: { handSize: 1 },
        cards: [
            { id: 'resist', react: true },
            { id: 'dmg', type: Card.AD, damage: 5, canResist: true }
        ]
    });

    await q.$answer('P1', 'dmg', 'P2');
    await q.$answer('P2');
    t.like(await q.$type(Event.STAT), { wizard: 'P2', hitPoints: -5 });
});

test('Cancels', async t => {
    const [, q] = getGame({
        config: { handSize: 3 },
        cards: [
            { id: 'dmg3', damage: 5, canCancel: 2, type: Card.AD },
            { id: 'cancel4', cancel: true },
            { id: 'cancel3', cancel: true },
            { id: 'dmg2', damage: 5, canCancel: 2, type: Card.AD },
            { id: 'cancel2', cancel: true },
            { id: 'cancel1', cancel: true },
            { id: 'dmg1', damage: 5, canCancel: true, type: Card.AD },
        ]
    });

    // A card requiring a single cancel
    await q.$answer('P1', 'dmg1', 'P2');
    await q.$answer('P2', 'cancel3', Zone.UNSPECIFIED);
    const [
        [cancel],
        [discardCancel, discardCancelPayload],
        [discardDmg, discardDmgPayload]
    ] = await q.$dequeue(3);

    t.is(cancel, Event.CANCEL);
    t.is(discardCancel, Event.DISCARD);
    t.like(discardCancelPayload, { wizard: 'P2', card: 'cancel3' });
    t.is(discardDmg, Event.DISCARD);
    t.like(discardDmgPayload, { wizard: 'P1', card: 'dmg1' });

    // A card requiring two cancels met with two cancel cards.
    await q.$answer('P2', 'dmg2', 'P1');
    await q.$answer('P1', 'cancel1', Zone.UNSPECIFIED);
    await q.$answer('P1', 'cancel2', Zone.UNSPECIFIED);
    const [
        [cancel2],
        [discardCancel2, discardCancel2Payload],
        [discardCancel3, discardCancel3Payload],
        [discardDmg2, discardDmg2Payload]
    ] = await q.$dequeue(4);

    t.is(cancel2, Event.CANCEL);
    t.is(discardCancel2, Event.DISCARD);
    t.like(discardCancel2Payload, { wizard: 'P1', card: 'cancel1' });
    t.is(discardCancel3, Event.DISCARD);
    t.like(discardCancel3Payload, { wizard: 'P1', card: 'cancel2' });
    t.is(discardDmg2, Event.DISCARD);
    t.like(discardDmg2Payload, { wizard: 'P2', card: 'dmg2' });

    // A card requiring two cancels met with a single cancel card.
    await q.$answer('P1', 'dmg3', 'P2');
    await q.$answer('P2', 'cancel4', Zone.UNSPECIFIED);
    const [[damage, damagePayload], [discard]] = await q.$dequeue(3);

    t.is(damage, Event.STAT);
    t.like(damagePayload, { wizard: 'P2', hitPoints: -5 });
    t.is(discard, Event.DISCARD);
});

test('Anybody can cancel a spell', async t => {
    const [, q] = getGame({
        players: ['P1', 'P2', 'P3'],
        config: { handSize: 1 },
        cards: [
            { id: 'cancel', cancel: true },
            { id: 'dmg', damage: 5, canCancel: true, type: Card.AD },
        ]
    });

    await q.$answer('P1', 'dmg', 'P3');
    await q.$answer('P2', 'cancel');
    t.like(await q.$type(Event.CANCEL), {
        wizard: 'P1',
        targets: ['P3'],
        card: 'dmg',
        cards: ['cancel']
    });
});

test.skip('Cancelling an effect may require multiple cancels', async t => {

});

test('Redirects', async t => {
    const [, q] = getGame({
        config: { handSize: 1 },
        cards: [
            { id: 'redirect', redirect: true },
            { id: 'dmg', damage: 5, canRedirect: true, type: Card.AD },
        ]
    });

    await q.$answer('P1', 'dmg', 'P2');
    await q.$answer('P2', 'redirect', Zone.UNSPECIFIED);
    const [[discardRedirect], [damage, damagePayload], [discard]] = await q.$dequeue(3);

    t.is(discardRedirect, Event.DISCARD);
    t.is(damage, Event.STAT);
    t.like(damagePayload, { wizard: 'P1', hitPoints: -5 });
    t.is(discard, Event.DISCARD);
});

test('Acid', async t => {
    const diceRolls = [1, 2];
    const rng = { ...baseArgs.rng, dice: diceRolls.shift.bind(diceRolls) };
    const [, q] = getGame({
        rng,
        config: { handSize: 1 },
        cards: [
            { id: 'acid2', damage: 1, acid: true, type: Card.AD },
            { id: 'acid1', damage: 1, acid: true, type: Card.AD },
            { id: 'item2', target: Targets.SELF, play: Play.EQUIP },
            { id: 'item1', target: Targets.SELF, play: Play.EQUIP },
        ]
    });

    await q.$answer('P1', 'item1', 'P1');
    await q.$answer('P2', 'item2', 'P2');
    await q.$answer('P1', 'acid1', 'P2');
    t.like(await q.$type(Event.STAT), { hitPoints: -1 });
    t.like(await q.$type(Event.DISCARD), { card: 'item2' });

    await q.$answer('P2', 'acid2', 'P1');
    t.like(await q.$type(Event.STAT), { hitPoints: -1 });
    // The second dice roll fails and the item is not discard,
    // and thus the next discard event is the acid2 card.
    t.like(await q.$type(Event.DISCARD), { card: 'acid2' });
});

test('Lifesteal', async t => {
    const [, q] = getGame({
        config: { handSize: 1 },
        cards: [
            { id: 'lfst', damage: 5, type: Card.AD, lifesteal: true },
            { id: 'dmg', damage: 5, type: Card.AD }
        ]
    });

    await q.$answer('P1', 'dmg', 'P2');
    await q.$answer('P2', 'lfst', 'P1');
    const [
        [activate],
        [damage, damagePayload],
        [lifesteal, lifestealPayload],
        [discard]
    ] = await q.$dequeue(4);

    t.is(activate, Event.ACTIVATE);
    t.is(damage, Event.STAT);
    t.like(damagePayload, { wizard: 'P1', hitPoints: -5 });
    t.is(lifesteal, Event.STAT);
    t.like(lifestealPayload, { wizard: 'P2', hitPoints: 5 });
    t.is(discard, Event.DISCARD);
});

test('Sacrifice', async t => {
    const [, q] = getGame({ cards: [
        { id: 'dmg', damage: Calc.SACRIFICE, type: Card.AD, sacrifice: 5 }
    ] });

    await q.$answer('P1', 'dmg', 'P2');
    const [
        [activate],
        [sacrifice, sacrificePayload],
        [damage, damagePayload],
        [discard]
    ] = await q.$dequeue(4);

    t.is(activate, Event.ACTIVATE);
    t.is(sacrifice, Event.STAT);
    t.like(sacrificePayload, { wizard: 'P1', hitPoints: -5 });
    t.is(damage, Event.STAT);
    t.like(damagePayload, { wizard: 'P2', hitPoints: -5 });
    t.is(discard, Event.DISCARD);
});

test('Untargettable', async t => {
    const [g, q] = getGame({
        players: ['P1', 'P2', 'P3'],
        config: { handSize: 1 },
        cards: [
            { id: 'left', play: Play.ACTIVATE, target: Targets.LEFT },
            { id: 'right', play: Play.ACTIVATE, target: Targets.RIGHT },
            { id: 'deadweight' },
            { id: 'targets', type: Card.AM },
            { id: 'target', type: Card.AD },
            { id: 'sanctuary', play: Play.EFFECT, target: Targets.SELF, untargettable: true },
        ]
    });

    await q.$answer('P1', 'sanctuary', 'P1');

    const { choices: ct } = await q.$type(Event.QUESTION);
    t.deepEqual(ct, [['target', ['P3', Zone.TALON]]]);
    g.send('P2', 'target', 'P3');

    const { choices: cts } = await q.$type(Event.QUESTION);
    t.deepEqual(cts, [['targets', [Zone.UNSPECIFIED, Zone.TALON]]]);
    g.send('P3', 'targets', Zone.UNSPECIFIED);

    const [[activateCts, activateCtsPayload]] = await q.$dequeue(1);
    t.is(activateCts, Event.ACTIVATE);
    t.like(activateCtsPayload, { targets: ['P2'] })

    await q.$answer('P1', 'deadweight', Zone.TALON);

    const { choices: cr } = await q.$type(Event.QUESTION);
    t.deepEqual(cr, [['right', [Zone.TALON]]]);
    g.send('P2', 'right', Zone.TALON);

    const { choices: cl } = await q.$type(Event.QUESTION);
    t.deepEqual(cl, [['left', [Zone.TALON]]]);
    g.send('P3', 'left', Zone.TALON);
});

test('React effect', async t => {
    const diceRolls = [15, 5];
    const rng = { ...baseArgs.rng, dice: diceRolls.shift.bind(diceRolls) };
    const [, q] = getGame({
        rng,
        config: { handSize: 1 },
        cards: [
            { id: 'effect2', target: Targets.OTHER, play: Play.EFFECT, canSave: true },
            { id: 'effect1', target: Targets.OTHER, play: Play.EFFECT, canSave: true },
        ]
    });

    await q.$answer('P1', 'effect1', 'P2');
    const [[e1, e1p]] = await q.$dequeue(1);

    t.is(e1, Event.EFFECT);
    t.like(e1p, { card: 'effect1', wizard: 'P1', targets: ['P2'] });

    await q.$answer('P2', 'effect2', 'P1');
    const [[e2, e2p], [save, savep]] = await q.$dequeue(2);

    t.is(e2, Event.EFFECT);
    t.like(e2p, { card: 'effect2', wizard: 'P2', targets: ['P1'] });

    t.is(save, Event.SAVE);
    t.like(savep, { card: 'effect2', wizard: 'P2' });
});

test.todo('Reveal');

test('Transfer body', async t => {
    const [, q] = getGame({
        config: { handSize: 1 },
        cards: [
            { id: 'deadweight1' },
            { id: 'deadweight2' },
            { id: 'transfer', transferBodies: true, type: Card.AD }
        ]
    });

    await q.$answer('P1', 'transfer', 'P2');
    await q.$answer('P1', 'deadweight2', Zone.TALON);
    await q.$answer('P2', 'deadweight1', Zone.TALON);

    t.pass();
});

test('Haste', async t => {
    const [, q] = getGame({
        config: { handSize: 3 },
        cards: [
            { id: 'deadweight' },
            { id: 'b', type: Card.AD },
            { id: 'a', type: Card.AD },
            { id: 'haste', haste: 2, type: Card.A }
        ]
    });

    await q.$answer('P1', 'haste', 'P1');
    await q.$answer('P1', 'a', 'P2');
    await q.$answer('P1', 'b', 'P2');

    t.pass();
});

test('Combo', async t => {
    const [, q] = getGame({
        config: { handSize: 3 },
        players: ['P1', 'P2', 'P3'],
        cards: [
            { id: 'deadweight' },
            { id: 'dmg', type: Card.AD, damage: 1 },
            { id: 'othercombo', type: Card.AD, combo: { count: 1 } },
            { id: 'deadweight', type: Card.AD },
            { id: 'dmg', type: Card.AD, damage: 1 },
            { id: 'combo', type: Card.AD, combo: { count: 1, type: Card.AD, multiplier: 2 } }
        ]
    });

    await q.$answer('P1', 'combo', 'P2');
    await q.$answer('P1', 'dmg');
    t.like(await q.$type(Event.STAT), { wizard: 'P2', hitPoints: -2 });

    await q.$answer('P2', 'othercombo', 'P1');
    await q.$answer('P2', 'dmg');
    t.like(await q.$type(Event.STAT), { wizard: 'P1', hitPoints: -1 });
});

test('Inactive', async t => {
    const [, q] = getGame({
        config: { handSize: 1 },
        cards: [
            { id: 'deadweight' },
            { id: 'dmg', type: Card.AD, canSave: true, savingThrow: 20, damage: 1 },
            { id: 'otherCard', type: Card.AD },
            { id: 'inactive', play: Play.EFFECT, target: Targets.OTHER, inactive: true }
        ]
    });

    t.like(await q.$type(Event.TURN), { wizard: 'P1' });

    await q.$answer('P1', 'inactive', 'P2');

    t.like(await q.$type(Event.TURN), { wizard: 'P2' });
    t.like(await q.$type(Event.TURN), { wizard: 'P1' });

    await q.$answer('P1', 'dmg', 'P2');

    // P2 cannot save because they are inactive.
    const [[activate], [dmg, dmgPayload]] = await q.$dequeue(2);

    t.is(activate, Event.ACTIVATE);

    t.is(dmg, Event.STAT);
    t.like(dmgPayload, { wizard: 'P2', hitPoints: -1 });
});

test('Resurrect', async t => {
    const [, q] = getGame({
        config: { handSize: 1 },
        cards: [
            { id: 'drawnDeadweight' },
            { id: 'discardedDeadweight' },
            { id: 'dmg', type: Card.AD, damage: 50 },
            { id: 'resurrectionRing', type: Card.O, item: Item.RING, resurrect: true }
        ]
    });

    await q.$answer('P1', 'resurrectionRing', 'P1');
    await q.$answer('P2', 'dmg', 'P1');

    const [
        , // Activate
        , // Damage
        , // Discard damage
        [resurrect, resurrectPayload],
        [d1, d1Payload],
        [d2, d2Payload],
        [draw, drawPayload]
    ] = await q.$dequeue(7);

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
    const [, q] = getGame({
        config: { handSize: 1 },
        cards: [
            { id: 'dmg', type: Card.AD, damage: 10 },
            { id: 'absorb', type: Card.O, absorb: 5 },
        ]
    });

    await q.$answer('P1', 'absorb', 'P1');
    await q.$answer('P2', 'dmg', 'P1');
    t.like(await q.$type(Event.STAT), { wizard: 'P1', hitPoints: -5 });
});

test('Counter', async t => {
    const [, q] = getGame({
        config: { handSize: 1 },
        cards: [
            { id: 'deadweight' },
            { id: 'deadweight' },
            { id: 'counter', play: Play.EFFECT, target: Targets.SELF, counter: 1 },
        ]
    });

    await q.$answer('P1', 'counter', 'P1');
    await q.$answer('P2', 'deadweight', Zone.TALON);
    await q.$answer('P1', 'deadweight', Zone.TALON);
    const [, [effectDiscard, effectDiscardP]] = await q.$dequeue(2);

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
        const [, q] = getGame({
            config: { handSize: 7 },
            cards: [
                handObject, handEffect, handSpell, effect, ring1, ring2, robe,
                deadweight, deadweight, deadweight, deadweight, deadweight, deadweight, card,
            ]
        });

        for (const item of [effect, ring1, ring2, robe]) {
            await q.$answer('P1', 'deadweight', Zone.TALON);
            await q.$answer('P2', item.id, 'P2');
        }

        await q.$answer('P1', card.id, 'P2');

        answer.length && (await q.$answer(...answer));

        for (const discardedItem of expectedDiscard)
            t.like(await q.$type(Event.DISCARD), { wizard: 'P2', card: discardedItem.id });

        t.pass();
    });
}

test('Steal', async t => {
    const [, q] = getGame({
        config: { handSize: 1 },
        cards: [
            { id: 'steal', type: Card.CO, steal: [Item.CHOOSE, Item.EQUIPPED] },
            ring1,
        ]
    });

    await q.$answer('P1', 'ring1', 'P1');
    await q.$answer('P2', 'steal', 'P1');

    const stealPayload = await q.$type(Event.STEAL);
    t.like(stealPayload, { wizard: 'P2', targets: ['P1'], card: 'ring1' });
});

test('Multi', async t => {
    const [, q] = getGame({
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

    await q.$answer('P1', 'withSameTarget', 'P2');
    t.like(await q.$type(Event.STAT), { wizard: 'P2', hitPoints: -1 });
    t.like(await q.$type(Event.STAT), { wizard: 'P2', hitPoints: -1 });

    await q.$answer('P2', 'deadweight1', Zone.TALON);
    await q.$answer('P3', 'deadweight4', Zone.TALON);
    await q.$answer('P1', 'withImplicitTargets', 'P1');
    t.like(await q.$type(Event.STAT), { wizard: 'P2', hitPoints: -1 });
    t.like(await q.$type(Event.STAT), { wizard: 'P3', hitPoints: -1 });

    await q.$answer('P2', 'deadweight2', Zone.TALON);
    await q.$answer('P3', 'deadweight5', Zone.TALON);
    await q.$answer('P1', 'withIndividualSaves', 'P2');
    t.like(await q.$type(Event.STAT), { wizard: 'P2', hitPoints: -1 });
    t.like(await q.$type(Event.SAVE), { wizard: 'P1', targets: ['P2'] });
});

test('Desintegrate', async t => {
    const [, q] = getGame({ cards: [
        { id: 'kill', type: Card.AD, desintegrate: true }
    ] });

    await q.$answer('P1', 'kill', 'P2');
    t.like(await q.$type(Event.DEATH), { wizard: 'P2' });
});

test('Reshuffle', async t => {
    const [, q] = getGame({
        config: { handSize: 1 },
        cards: [
            { id: 'reshuffle', play: Play.ACTIVATE, reshuffle: true, target: Targets.OTHERS },
            ...Array.gen(2, i => ({ id: 'deadweight' + (2 - i) }))
        ]
    });
    await q.$answer('P1', 'deadweight1', Zone.TALON);
    await q.$answer('P2', 'deadweight2', Zone.TALON);
    await q.$answer('P1', 'reshuffle', Zone.UNSPECIFIED);
    const [, [reshuffle, reshufflePayload]] = await q.$dequeue(2);

    t.is(reshuffle, Event.RESHUFFLE);
    t.like(reshufflePayload, { cards: ['deadweight1', 'deadweight2'] });

    // At P2's turn there were no cards to draw so it's P1's turn again.
    await q.$answer('P1', 'deadweight2', Zone.TALON);
    await q.$answer('P2', 'deadweight1', Zone.TALON);
});

test('Equip caps', async t => {
    const [, q] = getGame({
        config: { handSize: 3 },
        cards: [
            ...Array.gen(2, i => ({ id: 'robe' + (2 - i), type: Card.O, item: Item.ROBE })),
            ...Array.gen(3, i => ({ id: 'ring' + (3 - i), type: Card.O, item: Item.RING }))
        ]
    });

    await q.$answer('P1', 'ring1', 'P1');
    await q.$answer('P2', 'robe1', 'P2');
    await q.$answer('P1', 'ring2', 'P1');
    await q.$answer('P2', 'robe2', 'P2');
    t.like(await q.$type(Event.DISCARD), { wizard: 'P2', card: 'robe1' });

    await q.$answer('P1', 'ring3', 'P1');
    await q.$answer('P1', 'ring1');
    t.like(await q.$type(Event.DISCARD), { wizard: 'P1', card: 'ring1' });
});
