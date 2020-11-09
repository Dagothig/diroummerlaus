const { CardTypes, EventTypes: { DRAW, QUESTION, PLAY } } = require('./definitions');

class Player {
    constructor({ name, hitPoints }) {
        this.name = name;
        this.hand = [];
        this.currentHitPoints = hitPoints;
        this.maxHitPoints = hitPoints;
    }

    get isAlive() {
        return this.currentHitPoints > 0;
    }

    get powerLevel() {
        return 1;
    }
}

class Game {
    constructor({
        config,
        cards,
        players,
        onEvent
    }) {
        this.config = config;
        this.wizards = players.map(name => new Player({
            name,
            hitPoints: config.hitPoints
        })).shuffle();
        this.wizards.forEach((wizard, index) => wizard.index = index);
        this.questions = [];
        this.event = onEvent;
        this.pile = cards.slice().shuffle();
        this.talon = [];
        this.byCardType = {
            [CardTypes.AM]: {
                targets: ({ wizard }) => this.wizards.except(wizard)
            },
            [CardTypes.A]: {
                targets: ({ wizard }) => [wizard]
            },
            [CardTypes.AD]: {
                targetChoices: ({ wizard }) => this.wizards.except(wizard)
            },
            [CardTypes.E]: {

            },
            [CardTypes.S]: {

            }
        }
    }

    ask(question) {
        if (!question.choices.length) {
            return {};
        }
        const promise = new Promise(res => question.resolve = res);
        this.questions.push(question);
        this.event({ type: QUESTION, question });

        return promise;
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

    async run() {
        await Promise.all(this.wizards.map(wizard => this.drawMissingCards({ wizard })));
        let turn = this.wizards.length - 1;
        while (turn !== (turn = this.wizards.findIndexFrom(turn + 1, wizard => wizard.isAlive))) {
            const wizard = this.wizards[turn];
            await this.counterDecrease({ wizard });
            await this.activateEffects({ wizard });
            await this.playCard({ wizard });
            await this.discardExpiredEffects({ wizard });
            await this.drawMissingCards({ wizard });
        }
    }

    counterDecrease() {

    }

    activateEffects() {

    }

    targetChoices({ card }) {
        return (
            card.targetChoices ||
            this.byCardType[card.type].targetChoices ||
            Function.noop);
    }

    targets({ card, target }) {
        return (
            (target && [target]) ||
            card.targets ||
            this.byCardType[card.type].targets ||
            Function.noop);
    }

    discard({ card }) {
        return (
            card.discard ||
            this.byCardType[card.type].discard ||
            Function.noop);
    }

    async onTarget({ wizard, target, canResist, canCancel, canRedirect }) {
        const { card } = await this.ask({
            wizard: target,
            choices: wizard.hand
                .filter(card =>
                    (canResist && card.onResist) ||
                    (canCancel && card.onCancel) ||
                    (canRedirect && card.onRedirect))
                .map(card => ({
                    card,
                    targets: this.targetChoices({ card })({ game: this, wizard: target })
                }))
        });
        if (card) {
            return card.onTarget({ game: this, wizard: target, card, target: wizard });
        } else {
            return target;
        }
    }

    async onDeath({ wizard }) {

    }

    async playCard({ wizard }) {
        const { card, target } = await this.ask({
            wizard,
            choices: wizard.hand.map(card => ({
                card,
                targets: this.targetChoices({ card })({ game: this, wizard })
            }))
        });

        const targets = (await Promise.all(
            this.targets({ card, target })({ game: this, wizard }).map(target =>
                this.onTarget({ ...card, wizard, target })))
        ).filter(Function.id);

        this.event({ type: PLAY, wizard, target, card });

        const discard = this.discard({ card })({ game: this, wizard });
        if (discard) {
            this.event({ type: DRAW, source: wizard.hand, target: discard, cards: [card] });
            wizard.hand.remove(card);
            discard.push(card);
        }

        await card.onPlay({ game: this, wizard, card, targets });
    }

    discardExpiredEffects() {

    }

    drawMissingCards({ wizard }) {
        const cards = this.pile.take(this.config.handSize - wizard.hand.length);
        wizard.hand.push(...cards);
        this.event({ type: DRAW, source: this.pile, target: wizard, cards });
    }

    async damage({ wizard, target, targets, amount }) {
        targets = [...targets, target].filter(Function.id);
        targets.forEach(target => {
            target.hitPoints -= amount;
            this.event({ type: this.damage, wizard, target, amount });
        });
        await Promise.all(targets
            .filter(target => !target.isAlive)
            .map(dead => this.onDeath({ wizard: dead })));
    }

    roll(min, max) {
        return Math.randint(min, max);
    }
}

module.exports = Game;
