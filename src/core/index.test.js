const test = require('ava');
const { Game, cards, definitions: { EventTypes: { DRAW, QUESTION } } } = require('.');
const { CardTypes } = require('./definitions');

class AsyncQueue {
    constructor() {
        this.backing = [];
        this.awaiting = [];
    }

    enqueue(...values) {
        for (let value of values) {
            if (this.awaiting.length) {
                this.awaiting.shift()(value);
            } else {
                this.backing.push(value);
            }
        }
    }

    async dequeue(n = 1) {
        const taken = this.backing;
        this.backing = this.backing.slice(n);
        taken.length = Math.min(taken.length, n);
        const remaining = [];
        this.awaiting.push(...Array.gen(n - taken.length, () => {
            let resolve;
            remaining.push(new Promise(res => resolve = res));
            return resolve;
        }));
        taken.push(...await Promise.all(remaining));
        return taken;
    }

    async find(fn) {
        do {
            const [next] = await this.dequeue();
            if (fn(next)) {
                return next;
            }
        } while(true);
    }
}

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
    await game.send(event.question.wizard, choice);

    const playEvent = await msgs.dequeue();
    t.like(playEvent, {
        type: PLAY,
        wizard: game.wizards[0],
        target: undefined,
        card: cards.PluieDeBoulesDeFeu
    });

    const damageEvents = await msgs.dequeue(2);
    players.except(event.wizard.name).forEach(player => {
        const damageEvent = damageEvent.find(e => e.target.name === player);
    });
});
