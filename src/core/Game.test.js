const test = require('ava');
const { Game, cards, definitions: { Card, Calc, Targets, Event, Zone } } = require('.');
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

    return [game, queue];
}

test('Base turn', async t => {
    let [game, queue] = getGame({ cards: Array.gen(11, i => ({ id: i })) });

    game.$run();

    const [
        [drawP1, drawP1Payload],
        [drawP2, drawP2Payload],
        [turn, turnPayload],
        [question, questionPayload]
    ] = await queue.$dequeue(4);

    t.is(drawP1, Event.DRAW);
    t.like(drawP1Payload, {
        wizard: { player: 'P1' },
        cards: [{ id: 6 }, { id: 7 }, { id: 8 }, { id: 9 }, { id: 10 }]
    });

    t.is(drawP2, Event.DRAW);
    t.like(drawP2Payload, {
        wizard: { player: 'P2' },
        cards: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]
    });

    t.is(turn, Event.TURN);
    t.like(turnPayload, { wizard: { player: 'P1' } });

    t.is(question, Event.QUESTION);
    t.like(questionPayload, {
        wizard: { player: 'P1' },
        choices: [
            [{ id: 6 }, [Zone.TALON]],
            [{ id: 7 }, [Zone.TALON]],
            [{ id: 8 }, [Zone.TALON]],
            [{ id: 9 }, [Zone.TALON]],
            [{ id: 10 }, [Zone.TALON]],
        ]
    });

    game.send('P1', 0, 0);

    const [
        [discard, discardPayload],
        [drawMissing, drawMissingPayload],
        [newTurn, newTurnPayload]
    ] = await queue.$dequeue(3);

    t.is(discard, Event.DISCARD);
    t.like(discardPayload, { wizard: { player: 'P1' }, card: { id: 6 } });

    t.is(drawMissing, Event.DRAW);
    t.like(drawMissingPayload, { wizard: { player: 'P1' }, cards: [{ id: 0 }] });

    t.is(newTurn, Event.TURN);
    t.like(newTurnPayload, { wizard: { player: 'P2' } });

    game = null;
    queue = null;
});

test.todo('Card types');

test.todo('Play card types');

test.todo('Target types')

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
