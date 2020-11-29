const test = require('ava');
const { Game, cards, definitions: { EventTypes: { DRAW, QUESTION, PLAY, DAMAGE } } } = require('.');
const { CardTypes } = require('./definitions');
const AsyncQueue = require('./AsyncQueue');

const players = ['bob', 'dagoth ig', 'georges'];
const config = { handSize: 10, hitPoints: 10 };

test('Game pretends to handle all card types', t => {
    const game = new Game({ players: [], cards: [], config: {} });

    Object.values(CardTypes).forEach(type =>
        t.truthy(game.byCardType[type], `${ type.toString() } is not defined`));
})

test('Game setup', async t => {
    const msgs = new AsyncQueue();
    const game = new Game({
        players,
        cards: Object.values(cards),
        config,
        onEvent: msgs.enqueue.bind(msgs)
    });

    game.run();

    const draws = await msgs.dequeue(3);
    for (const player of players) {
        const draw = draws.find(({ target }) => target.name === player);
        // TODO test the cards are setup properly;
        t.like(draw, { type: DRAW, source: game.pile });
        t.is(draw.target.currentHitPoints, config.hitPoints);
    }
});

test('PluiesDeBoulesDeFeu', async t => {
    const msgs = new AsyncQueue();
    const game = new Game({
        players,
        cards: [cards.PluieDeBoulesDeFeu],
        config,
        onEvent: msgs.enqueue.bind(msgs)
    });

    game.run();

    const event = await msgs.find(e => e.type === QUESTION);
    t.like(event, {
        type: QUESTION,
        question: { wizard: game.wizards[0] }
    });

    const choice = event.question.choices.find(choice => choice.card === cards.PluieDeBoulesDeFeu);
    await game.send(event.question.wizard.name, choice);

    const [playEvent] = await msgs.dequeue();
    t.like(playEvent, {
        type: PLAY,
        wizard: game.wizards[0],
        target: undefined,
        card: cards.PluieDeBoulesDeFeu
    });

    const damageEvents = await msgs.dequeue(2);
    players.except(event.question.wizard.name).forEach(player => {
        const damageEvent = damageEvents.find(e => e.target.name === player);
        t.like(damageEvent, {
            type: DAMAGE,
            wizard: event.question.wizard,
            target: {
                name: player,
                currentHitPoints: config.hitPoints - damageEvent.amount
            }
        })
    });
});
