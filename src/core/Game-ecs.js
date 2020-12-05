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
        play: [Events.CARD, Events.DISCARD],
        ...card
    }),
    [CardTypes.A]: card => ({
        target: Targets.SELF,
        play: [Events.CARD, Events.DISCARD],
        ...card
    }),
    [CardTypes.AD]: card => ({
        target: Targets.OTHER,
        play: [Events.CARD, Events.DISCARD],
        ...card
    }),
    [CardTypes.O]: card => ({
        target: Targets.SELF,
        counter: Number.POSITIVE_INFINITY,
        play: [Events.EQUIP],
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

const Turn = {
    [Events.TURN]([, nextTurn = 0]) {
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
}

const Multi = {
    async [Events.ALL]([, ...events]) {
        await Promise.all(events.map(event => this.run(event)));
    }
}

const Phases = {
    [Events.COUNTER_DECREASE]([, wizard]) {
        wizard.effects.forEach(effect => effect.counter--);
    },
    async [Events.ACTIVATE_EFFECTS]([, wizard]) {
        const { card, target } = this.askCard(wizard, wizards.effects.filter(card => card.activate));
        return [[Events.CARD, wizard, card, target]];
    },
    [Events.PLAY_CARD]([, wizard]) {
        const { card, target } = this.askCard(wizard, wizard.hand.filter(card => card.play));
        return card.play.map(type => [type, wizard, card, target]);
    },
    [Events.DISCARD_EXPIRED_EFFECTS]([, wizard]) {
        const expired = wizard.effects.filter(effect => !effect.counter);
        return expired.map(card => [Events.DISCARD, wizard, card]);
    },
    [Events.DRAW_MISSING]([, wizard]) {
        return [[Events.DRAW, wizard, Math.max(config.handSize - wizard.hand, 0)]];
    }
};

const Discard = {
    [Events.DISCARD]([, wizard, card]) {
        wizard.hand.remove(card) || wizard.effects.remove(card) || wizard.equip.remove(card);
        return [];
    }
};

const Equip = {
    [Events.EQUIP]([, wizard, card]) {
        wizard.hand.remove(card);
        wizard.equip.push(card);
        return [];
    }
}

const Draw = {
    [Events.DRAW]([, wizard, amount]) {
        wizard.hand.push(...this.pile.take(amount));
        return [];
    }
}

const Card = {
    [Events.CARD]([, wizard, card, target]) {
        return [
            [Events.DAMAGE, wizard, card, target],
            [Events.HEAL, wizard, card, target],
            []
        ]
    }
}

const TargetsHandler = {
    [Targets.SELF](wizard) {
        return [wizard];
    },
    [Targets.OTHER](wizard) {
        return this.wizards.filter(w => w.isAlive).except(wizard);
    },
    [Targets.OTHERS](wizard) {
        return [this.wizards.filter(w => w.isAlive).except(wizard)];
    },
    [Targets.LEFT](wizard) {
        return this.wizards.findIndexFrom(
            this.wizards.indexOf(wizard) - 1,
            w => w.isAlive,
            -1);
    },
    [Targets.RIGHT](wizard) {
        return this.wizards.findIndexFrom(
            this.wizards.indexOf(wizard) + 1,
            w => w.isAlive);
    }
};

class Wizard {
    constructor(player,  { hitPoints }) {
        this.player = player;
        this.currentHitPoints = hitPoints;
        this.maxHitPoints = hitPoints;
        this.hand = [];
        this.equip = [];
        this.effects = [];
    }
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
        ].reduce((transformers, t) => {
            Object.getOwnPropertySymbols(t).forEach(type =>
                (transformers[type] || (transformers[type] = [])).push(t[type]));
            return transformers;
        }, {});

        this.targets = TargetsHandler;

        this.wizards = players.map(player => ({
            player,
            hitPoints: config.hitPoints,
            hand: [],
            equip: [],
            effects: []
        }));

        this.events = [
            [Events.ALL, ...this.wizards.map(wizard => [DRAW_MISSING, wizard])],
            [Events.TURN]];

        this.cards = cards.map(card => cardTypesMap[card.type](card));

        this.questions = [];
    }

    async run(events = this.events) {
        while (events.length) {
            const event = events.shift();
            events.unshift(...(await Promise.all(transformers.map(x => x(event)))).flat());
        }
    }

    ask(question) {
        if (!question.choices.length) {
            return {};
        }
        const promise = new Promise(res => question.resolve = res);
        this.questions.push(question);

        return promise;
    }

    askCard(wizard, cards) {
        return this.ask({
            wizard,
            choices: cards.map(card => {
                const choices = this.targets[card.target || Targets.SELF].call(this, );
            })
        });
    }

    send(player, answer) {
        const question = this.questions.find(question =>
            question.wizard.name === player &&
            question.choices.find(({ card, targets }) =>
                card === answer.card &&
                ((!targets && !answer.target) || (targets && targets).includes(answer.target))));
        if (question) {
            this.questions.remove(question);
            question.resolve(answer);
        }
    }
}
