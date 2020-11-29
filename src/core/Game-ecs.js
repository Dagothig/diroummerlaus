const {
    CardTypes,
    EventTypes,
    Calc,
    Fns,
    Targets,
    Events
} = require('./definitions');

const cardTypesMap = {
    [CardTypes.AM]: card => ({
        target: Targets.OTHERS,
        playable: true,
        ...card
    }),
    [CardTypes.A]: card => ({
        target: Targets.SELF,
        playable: true,
        ...card
    }),
    [CardTypes.AD]: card => ({
        playable: true,
        ...card
    }),
    [CardTypes.O]: card => ({
        target: Targets.SELF,
        counter: Number.POSITIVE_INFINITY,
        playable: true,
        ...card
    }),
    [CardTypes.E]: card => ({
        playable: true,
        ...card
    }),
    [CardTypes.S]: card => ({
        playable: true,
        ...card
    }),
    [CardTypes.ST]: card => ({
        playable: true,
        ...card
    }),
    [CardTypes.O]: card => ({
        playable: true,
        ...card
    }),
    [CardTypes.CO]: card => ({
        playable: true,
        ...card
    }),
    [CardTypes.CA]: card => ({
        playable: false,
        reactive: true,
        ...card
    })
};

function mapped(map) {
    function FN(event) {
        const [type] = event;
        return map[type].call(this, event);
    }
    FN.types = Object.getOwnPropertySymbols(map);
    return FN;
}

function Turn([, nextTurn = 0]) {
    for (let i = 0; i < this.wizards.length; i++) {
        const turn = (nextTurn + i) % this.wizards.length;
        const wizard = this.wizards[turn];
        if (wizard.isAlive) {
            return [
                [Events.COUNTER_DECREASE, wizard],
                [Events.ACTIVATE_EFFECTS, wizard],
                [Events.PLAY_CARD, wizard],
                [Events.DISCARD_EXPIRED_EFFECTS, wizard],
                [Events.TURN, (turn + 1) % this.wizards.length]
            ];
        }
    }
    return [];
}

Turn.types = [Events.TURN];

async function Multi([, ...events]) {
    await Promise.all(events.map(event => this.run(event)));
}

Multi.types = [Events.ALL];

const Phases = mapped({
    [Events.COUNTER_DECREASE]: function ([, wizard]) {
        wizard.effects.forEach(effect => effect.counter--);
    },
    [Events.ACTIVATE_EFFECTS]: async function ([, wizard]) {
        const canAsk = wizard.effects.filter(effect => effect.activate);
        const { card, target } = this.ask(wizard, canAsk);
        return [[Events.CARD, wizard, card, target]];
    },
    [Events.PLAY_CARD]: function ([, wizard]) {
        const canAsk = wizard.hand.filter(card => card.playable);
        const { card, target } = this.ask(wizard, canAsk);
        return [
            [Events.CARD, wizard, card, target],
            [card.equip ? Events.EQUIP : card.effect ? Events.EFFECT : Events.DISCARD,
                wizard, card, target
            ]
        ]
    },
    [Events.DISCARD_EXPIRED_EFFECTS]: function ([, wizard]) {
        const expired = wizard.effects.filter(effect => !effect.counter);
        return expired.map(card => [Events.DISCARD, wizard, card]);
    },
    [Events.DRAW_MISSING]: function ([, wizard]) {
        return [[Events.DRAW, wizard, Math.max(config.handSize - wizard.hand, 0)]];
    }
});

function Discard([, wizard, card]) {
    wizard.hand.remove(card) || wizard.effects.remove(card) || wizard.equip.remove(card);
    return [];
}

Discard.types = [Events.DISCARD];

function Draw([, wizard, amount]) {
    wizard.hand.push(...this.pile.take(amount));
    return [];
}

module.exports = class Game {
    constructor({
        config,
        cards,
        players,
        onEvent
    }) {
        this.transformers = [
            Multi,
            Turn,
            Phases,
            Discard
        ].reduce((transformers, fn) => {
            fn.types.forEach(type => {
                transformers[type] = transformers[type] || [];
                transformers[type].push(fn);
            });
            return transformers;
        }, {});
        this.wizards = players;
        this.events = [
            [Events.ALL, ...this.wizards.map(wizard => [DRAW_MISSING, wizard])],
            [Events.TURN]
        ];
        cards = cards.map(card => cardTypesMap[card.type](card));
    }

    async run(events = this.events) {
        while (events.length) {
            const event = events.shift();
            events.unshift(...(await Promise.all(transformers.map(x => x(event)))).flat());
        }
    }
}
