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

test.todo('Death');

test.todo('Calculations based on power-level');

test.todo('Calculations based on hp');

test.todo('Calculations with rolls');

test.todo('Calculations with math');

test.todo('Damage');

test.todo('Heal');

test.todo('Acid');

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

test.todo('Saves');

test.todo('Partial saves');

test.todo('Resists');

test.todo('Cancels');

test.todo('Multi-cancels');

test.todo('Redirects');

test.todo('Card types');
