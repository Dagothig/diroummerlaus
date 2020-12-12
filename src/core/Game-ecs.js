const definitions = require('./definitions');
const {
    CardTypes,
    EventTypes,
    Calc,
    Fns,
    Targets,
    Play,
    Control,
    Events,
} = require('./definitions');

const cardTypesMap = {
    [CardTypes.AM]: card => ({
        target: Targets.OTHERS,
        play: Play.ACTIVATE,
        ...card
    }),
    [CardTypes.A]: card => ({
        target: Targets.SELF,
        play: Play.ACTIVATE,
        ...card
    }),
    [CardTypes.AD]: card => ({
        target: Targets.OTHER,
        play: Play.ACTIVATE,
        ...card
    }),
    [CardTypes.O]: card => ({
        target: Targets.SELF,
        play: Play.EQUIP,
        ...card
    }),
    [CardTypes.E]: card => ({
        play: Play.ACTIVATE,
        ...card
    }),
    [CardTypes.S]: card => ({
        play: Play.ACTIVATE,
        ...card
    }),
    [CardTypes.ST]: card => ({
        play: Play.ACTIVATE,
        ...card
    }),
    [CardTypes.O]: card => ({
        play: Play.EQUIP,
        ...card
    }),
    [CardTypes.CO]: card => ({
        play: Play.ACTIVATE,
        ...card
    }),
    [CardTypes.CA]: card => ({
        reactive: true,
        ...card
    })
};

const Multi = {
    async [Events.ALL]([, ...eventStacks]) {
        if (eventStacks.length === 1) return eventStacks[0];
        await Promise.all(eventStacks.map(stack => this.run(stack)));
        return [definitions.CONTINUE];
    }
}

const Turn = {
    [Events.TURN]([, nextTurn = 0]) {
        const turn = this.wizards.findIndexFrom(nextTurn, w => w.isAlive);
        const wizard = this.wizards[turn];
        return wizard && [
            [Events.COUNTER_DECREASE, wizard],
            [Events.ACTIVATE_EFFECTS, wizard],
            [Events.PLAY_CARD, wizard],
            [Events.DISCARD_EXPIRED_EFFECTS, wizard],
            [Events.TURN, turn + 1]];
    },
    [Events.COUNTER_DECREASE]([, wizard]) {
        wizard.effects.forEach(effect => effect.counter--);
    },
    async [Events.ACTIVATE_EFFECTS]([, wizard]) {
        const [card, targets] = await this.askCard(wizard, wizards.effects.filter(c => c.activate));
        return [
            [Events.ALL, ...targets.map(target => [
                [Events.CARD, wizard, card, target]])],
            definitions.CONTINUE];
    },
    async [Events.PLAY_CARD]([, wizard]) {
        const [card, targets] = await this.askCard(wizard, wizard.hand.filter(c => c.play));
        switch (card.Play) {
            case Play.ACTIVATE:
                return [
                    [Events.CARD, wizard, card, targets],
                    [Events.DISCARD, wizard, card],
                    definitions.CONTINUE];
            case Play.EQUIP:
                return [
                    [Events.EQUIP, wizard, card],
                    definitions.CONTINUE];
            case Play.EFFECT:
                return [
                    [Events.EFFECT, wizard, card],
                    definitions.CONTINUE];
        }
        return
    },
    [Events.DISCARD_EXPIRED_EFFECTS]([, wizard]) {
        const expired = wizard.effects.filter(effect => !effect.counter);
        return [
            ...expired.map(card => [Events.DISCARD, wizard, card]),
            definitions.CONTINUE];
    },
    [Events.DRAW_MISSING]([, wizard]) {
        return [
            [Events.DRAW, wizard, Math.max(config.handSize - wizard.hand, 0)],
            definitions.CONTINUE];
    }
}

const Discard = {
    [Events.DISCARD]([, wizard, card]) {
        wizard.hand.remove(card) || wizard.effects.remove(card) || wizard.equip.remove(card);
        return [
            definitions.CONTINUE];
    }
};

const Draw = {
    [Events.CARD]([, , card, targets]) {
        return [
            card.draw && [
                [Events.ALL, ...targets.map(target => [
                    [Events.DRAW, target, card.draw]])]],
            definitions.CONTINUE];
    },
    [Events.DRAW]([, wizard, amount]) {
        wizard.hand.push(...this.pile.take(amount));
        return [
            definitions.CONTINUE];
    }
};

const Cancel = {
    async [Events.CARD]([, wizard, card, targets]) {
        if (!card.canCancel) return;
        const ctl = Promise.controller();
        const [target, cancelCards] = await Promise.findAsync(
            targets.map(async target => {
                const cancelCards = [];
                for (let i = 0; i < card.canCancel; i++) {
                    const availableCards = target.hand.except(cancelCards).filter(c = c.cancel);
                    const card = await this.askCard(target, availableCards, ctl);
                    if (!card) return [];
                    cancelCards.push(card);
                }
                return [target, cancelCards];
            }),
            x => x.length);
        ctl.abort();

        return [
            ...cancelCards.map(c => [Events.DISCARD, target, c]),
            [Events.DISCARD, wizard, card]];
    }
};

const Redirect = {
    async [Events.CARD]([, wizard, card, target]) {
        if (!card.canRedirect) return;
        const [redirectCard] = await this.askCard(target, target.hand.filter(c => c.redirect));
        return [
            [Events.CARD, wizard, card, wizard],
            [Events.DISCARD, target, redirectCard]];
    }
};

const Resist = {};

const Sacrifice = {
    [Events.CARD](event) {
        return [
            [Events.SACRIFICE, event.slice(1)]];
    },
    [Events.SACRIFICE]([, wizard, card, target]) {
        return [
            [Events.CALC, wizard, card, target, ['sacrifice', card.sacrifice]],
            [Events.STAT, wizard, 'hitPoints']];
    }
};

const Damage = {
    [Events.CARD](event) {
        return [
            [Events.DAMAGE, event.slice(1)]];
    },
    [Events.DAMAGE]([, wizard, card, target]) {
        return [
            [Events.CALC, wizard, card, target, [Calc.MUL, card.damage, -1]],
            [Events.STAT, target, 'hitPoints']];
    }
};

const Heal = {
    [Events.CARD](event) {
        return [
            [Events.HEAL, event.slice(1)]];
    },
    [Events.HEAL]([, wizard, card, target]) {
        return [
            [Events.CALC, wizard, card, target, card.heal],
            [Events.STAT, target, 'hitPoints']];
    }
};

const Card = {
    [Events.EQUIP]([, wizard, card]) {
        wizard.hand.remove(card);
        wizard.equip.push(card);
    },
    [Events.EFFECT]([, wizard, card]) {
        wizard.hand.remove(card);
        wizard.effects.push(card);
    }
};

const Calculations = {
    async [Events.CALC]([, wizard, card, target, value]) {
        this.values = { ...this.values, wizard, card, target };
        this.result = await Calculations.compute.call(this, value);
    },
    [Events.STAT]([, wizard, stat]) {
        wizard[stat] += this.result;
    },
    async compute(value) {
        return (
            typeof(value) === 'number' ?
                value :
            typeof(value) === 'string' ?
                this.values[value] :
            typeof(value) === 'symbol' ?
                Calculations[value].compute.call(this, [value]) :
            typeof(value[0]) === 'string' ?
                Calculations.value.call(this, value) :
                Calculations[value[0]].call(this, value));
    },
    async value([key, newValue]) {
        return newValue ?
            (this.values[key] = await await Calculations.compute.call(this, newValue)) :
            this.values[key];
    },
    [Calc.MUL]([, ...values]) {
        return values.reduce(async (n, m) => await n * await Calculations.compute.call(this, m), 1);
    },
    [Calc.ADD]([, ...values]) {
        return values.reduce(async (n, m) => await n * await Calculations.compute.call(this, m), 0);
    },
    async [Calc.ROLL]([, amount, sides]) {
        return this.roll(
            await Calculations.compute.call(this, amount),
            await Calculations.compute.call(this, sides));
    },
    async [Calc.HP]([, wizard]) {
        return (await Calculations.compute.call(this, wizard) || this.caster).hitPoints;
    },
    async [Calc.PL]([, wizard]) {
        return (await Calculations.compute.call(this, wizard) || this.caster).powerLevel;
    },
    async [Calc.CHOOSE]([, value]) {
        return await this.askNumber(
            this.values.wizard,
            await Calculations.compute.call(this, value));
    },
    [Calc.CASTER]() {
        return this.values.wizard;
    },
    [Calc.TARGET]() {
        return this.values.target;
    }
};

module.exports = class Game {
    transformers = [
        Multi,
        Turn,
        Discard,
        Draw,
        Sacrifice,
        Damage,
        Heal,
        Redirect,
        Cancel,
        Resist,
        Card,
        Calculations
    ].reduce((transformers, t) => {
        Object.getOwnPropertySymbols(t).forEach(type =>
            (transformers[type] || (transformers[type] = [])).push(t[type]));
        return transformers;
    }, {});

    targets = {
        [Targets.SELF](wizard) {
            return [[wizard]];
        },
        [Targets.OTHER](wizard) {
            return this.wizards.filter(w => w.isAlive).except([wizard]);
        },
        [Targets.OTHERS](wizard) {
            return [this.wizards.filter(w => w.isAlive).except(wizard)];
        },
        [Targets.LEFT](wizard) {
            return [
                this.wizards.findIndexFrom(
                    this.wizards.indexOf(wizard) - 1,
                    w => w.isAlive,
                    -1)
            ];
        },
        [Targets.RIGHT](wizard) {
            return [
                this.wizards.findIndexFrom(
                    this.wizards.indexOf(wizard) + 1,
                    w => w.isAlive)
            ];
        }
    };

    constructor({ config, cards, players, onEvent }) {
        this.wizards = players.map(player => ({
            player,
            hitPoints: config.hitPoints,
            hand: [],
            equip: [],
            effects: [],
            get maxHitPoints() { return config.hitPoints },
            get isAlive() { return this.hitPoints > 0; }
        }));

        this.events = [
            [Events.ALL, ...this.wizards.map(wizard => [[DRAW_MISSING, wizard]])],
            [Events.TURN]];

        this.cards = cards.map(card => cardTypesMap[card.type](card));

        this.questions = [];
    }

    async run(events = this.events) {
        while (events.length) {
            const event = events.shift();
            const transformed = [];
            for (const transformer of this.transformers[event[0]]) {
                const forTransformer = transformer(event);
                transformed.push(...forTransformer);
                if (forTransformer.includes(Control.STOP)) {
                    break;
                }
            }
            events.push(...(await Promise.all(transformers.map(x => x(event)))).flat());
        }
    }

    ask(question) {
        if (!question.choices.length) {
            return {};
        }
        const promise = new Promise(res =>
            question.resolve = result => (
                this.questions.remove(question),
                res(result)));
        this.questions.push(question);
        question.controller && question.controller.onAbort(question.resolve);

        return promise;
    }

    askCard(wizard, cards, controller) {
        return this.ask({
            wizard,
            choices: cards.map(card => [
                card,
                this.targets[card.target || Targets.SELF].call(this, wizard)
            ]),
            canCancel: true,
            controller
        });
    }

    askNumber(wizard, max, controller) {

    }

    send(player, choiceIndex, subChoiceIndex) {
        const question = this.questions.find(question => question.wizard.name === player);
        const [answer, subChoices] = question && question.choices[choiceIndex];
        const subAnswer = subChoices && subChoices[subChoiceIndex];
        if (question && (!question.canCancel || answer)) {
            question.resolve(subAnswer ? [answer, subAnswer] : answer);
        }
    }
}
