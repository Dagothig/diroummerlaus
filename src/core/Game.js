const {
    Card,
    Event,
    Calc,
    Targets,
    Play,
    Zone
} = require('./definitions');

class Game {
    static defaultConfig = {
        powerLevel: 1,
        savingThrow: 10,
        hitPoints: 50,
        handSize: 5
    };

    static cardTypes = {
        [Card.AM]: { target: Targets.OTHERS, play: Play.ACTIVATE },
        [Card.A]: { target: Targets.SELF, play: Play.ACTIVATE },
        [Card.AD]: { target: Targets.OTHER, play: Play.ACTIVATE },
        [Card.O]: { target: Targets.SELF, play: Play.EQUIP },
        [Card.E]: { play: Play.ACTIVATE },
        [Card.S]: { play: Play.ACTIVATE },
        [Card.ST]: { play: Play.ACTIVATE },
        [Card.O]: { targets: Targets.SELF, play: Play.EQUIP },
        [Card.CO]: { play: Play.ACTIVATE },
        [Card.CA]: { react: Play.EFFECT }
    }

    constructor({ config, cards, players, rng = Math }) {
        const game = this;
        this.listeners = [];
        this.config = { ...Game.defaultConfig, ...config };
        this.rng = rng;
        this.wizards = rng.shuffle(players.map(player => ({
            stat(key) {
                return (
                    game.config[key] +
                    this.effects.sum(c => c[key]) +
                    this.equip.sum(c => c[key]));
            },
            player,
            hitPoints: game.config.hitPoints,
            hand: [],
            equip: [],
            effects: [],
            get maxHitPoints() { return game.config.hitPoints },
            get isAlive() { return this.hitPoints > 0; },
            get powerLevel() { return this.stat('powerLevel'); },
            get savingThrow() { return this.stat('savingThrow'); }
        })));

        this.pile = rng.shuffle(cards.map(c => ({ ...Game.cardTypes[c.type], ...c })));
        this.talon = [];
        this.questions = [];
    }

    onEvent(listener) {
        this.listeners.push(listener);
    }

    unEvent(listener) {
        this.listeners.remove(listener);
    }

    event(type, payload) {
        this.listeners.forEach(l => l(type, payload));
    }

    async $ask(wizard, choices, controller) {
        if (!choices.length) return [];
        const question =  { player: wizard.player, choices, controller };
        controller && controller.onAbort(() => question.resolve([]));
        const $promise = new $(res => question.resolve = res)
            .then(n => (this.questions.remove(question), n));
        this.questions.push(question);
        this.event(Event.QUESTION, { wizard, choices });
        return $promise;
    }

    async $askCard(wizard, cards, controller) {
        return this.$ask(wizard, cards.map(c => [c]), controller);
    }

    targets(wizard, card) {
        switch (card.target) {
            case Targets.SELF:
                return [[wizard]];
            case Targets.OTHER:
                return this.wizards.filter(w => w.isAlive).except([wizard]);
            case Targets.OTHERS:
                return [this.wizards.filter(w => w.isAlive).except(wizard)];
            case Targets.LEFT:
                return [
                    this.wizards.findIndexFrom(
                        this.wizards.indexOf(wizard) - 1,
                        w => w.isAlive,
                        -1)];
            case Targets.RIGHT:
                return [
                    this.wizards.findIndexFrom(
                        this.wizards.indexOf(wizard) + 1,
                        w => w.isAlive)];
            default:
                return [];
        }
    }

    async $askCardWithTarget(wizard, cards, allowDiscard, controller) {
        return this.$ask(
            wizard,
            cards.map(c => [
                c,
                this.targets(wizard, c)
                    .concat(allowDiscard ? [Zone.TALON] : [])]),
            controller);
    }

    async $askNumber(wizard, number, controller) {
        return this.$ask(wizard, Array.gen(number).map(n => [n]), controller);
    }

    send(player, choice, subChoice) {
        const question = this.questions.find(question => question.player === player);
        const [answer, subChoices] = question?.choices[choice];
        const subAnswer = subChoices && subChoices[subChoice];
        question && question.resolve([answer, subAnswer]);
    }

    roll(amount, sides) {
        return rng.dice(amount, sides);
    }

    async $calc(value, env) {
        const { wizard, target, sacrifice = 0 } = env;
        switch (typeof value) {
            case 'object':
                const args = await $.all(value.slice(1).map(n => this.$calc(n, env)));
                switch (args.length && value[0]) {
                    case Calc.MUL: return args.prod();
                    case Calc.ADD: return args.sum();
                    case Calc.ROLL: return this.roll.apply(this, args);
                    case Calc.HP: return args.sum(n => n.hitPoints);
                    case Calc.PL: return args.sum(n => n.powerLevel);
                    case Calc.CHOOSE:
                        // TODO - Support choosing other things than numbers.
                        return (await $.all(args.map(n => this.$askNumber(wizard, n)[0]))).sum();
                    default: return await this.$calc(value[0], env);
                }
            case 'symbol':
                switch (value) {
                    case Calc.MUL: return 1;
                    case Calc.HP: return wizard.hitPoints;
                    case Calc.PL: return wizard.powerLevel;
                    case Calc.CASTER: return wizard;
                    case Calc.TARGET: return target;
                    case Calc.SACRIFICE: return sacrifice;
                    default: return 0;
                }
            case 'number': return value;
            default: return 0;
        }
    }

    async $activateCard({ wizard, card, targets }) {
        if (card.canCancel) {
            const ctl = $.controller();
            const [target, cancelCards] = await targets
                .map(async target => {
                    const cancelCards = [];
                    for (let i = 0; i < card.canCancel; i++) {
                        const availableCards = target.hand.except(cancelCards).filter(c = c.cancel);
                        const [card] = await this.$askCard(target, availableCards, ctl);
                        if (!card) return [];
                        cancelCards.push(card);
                    }
                    return [target, cancelCards];
                })
                .$find(x => x.length);
            ctl.abort();

            if (cancelCards.length) {
                for (const cancelCard of cancelCards) {
                    await this.$discard({ wizard: target, card: cancelCard });
                }
                return;
            }
        }

        const sacrifice = await this.$calc(card.sacrifice, { wizard, card, targets });
        if (sacrifice) {
            this.stat(wizard, 'hitPoints', -sacrifice);
        }

        await $.all(targets.map(async target => {
            if (card.canRedirect) {
                const [redirectCard] = await this.$askCard(target, target.hand.filter(c => c.redirect));

                if (redirectCard) {
                    await this.$discard({ wizard: target, card: redirectCard });
                    target = wizard;
                }
            }

            const draw = await this.$calc(card.draw, { wizard, card, target, sacrifice });
            if (draw) {
                await this.$draw({ wizard: target, amount: draw });
            }

            if (card.canResist) {
                await this.$playCard({ wizard: target, action: 'react', allowDiscard: false });
            }

            const savingThrow = target.savingThrow + (card.savingThrow || 0);
            const saveMul = card.canSave === true ? 0 : card.canSave;
            const save = card.canSave && this.roll(1, 20) <= savingThrow && saveMul || 1;

            let damage = await this.$calc(card.damage, { wizard, card, target, sacrifice });
            damage *= save;
            if (damage) {
                const absorb = damage &&
                    (await $.all(target.equip
                        .filter(c => c.absorb)
                        .map(c => this.$calc(c.absorb, { wizard: target, card: c }))))
                    .sum();
                if (absorb) {
                    damage = Math.max(damage - absorb, 0);
                }
                if (damage) {
                    this.stat(target, 'hitPoints', -damage);
                }
                if (card.lifeSteal) {
                    this.stat(wizard, 'hitPoints', damage);
                }
            }

            let heal = await this.$calc(card.heal, { wizard, card, target, sacrifice });
            heal *= save;
            if (heal) {
                this.stat(target, 'hitPoints', heal);
            }
        }));
    }

    async $draw({ wizard, amount }) {
        const cards = this.pile.take(amount);
        wizard.hand.push(...cards);
        this.event(Event.DRAW, { wizard, cards });
    }

    async $discard({ wizard, card }) {
        wizard.hand.remove(card) || wizard.effects.remove(card) || wizard.equip.remove(card);
        this.talon.push(card);
        this.event(Event.DISCARD, { wizard, card });
    }

    async $equip({ wizard, card, targets }) {
        wizard.hand.remove(card);
        targets.forEach(target => target.equip.push(card));
    }

    async $affect({ wizard, card, targets }) {
        wizard.hand.remove(card);
        targets.forEach(target => target.effects.push(card));
    }

    stat(wizard, stat, amount) {
        wizard[stat] += amount;
    }

    async $run() {
        await $.all(this.wizards.map(wizard => this.$drawMissingCards({ wizard })));
        let turn = this.wizards.length - 1;
        while (turn !== (turn = this.wizards.findIndexFrom(turn + 1, wizard => wizard.isAlive))) {
            const wizard = this.wizards[turn];
            this.event(Event.TURN, { wizard });
            await this.$counterDecrease({ wizard });
            await this.$activateEffects({ wizard });
            await this.$playCard({ wizard });
            await this.$discardExpiredEffects({ wizard });
            await this.$drawMissingCards({ wizard });
        }
    }

    async $counterDecrease({ wizard }) {
        wizard.effects.forEach(effect => effect.counter--);
    }

    async $activateEffects({ wizard }) {
        const [card, targets] = await this.$askCardWithTarget(
            wizard,
            wizard.effects.filter(c => c.activate));
        if (card) {
            await this.$activateCard({ wizard, card, targets });
        }
    }

    async $playCard({ wizard, action = 'play', allowDiscard = true }) {
        const [card, targets] = await this.$askCardWithTarget(
            wizard,
            wizard.hand.filter(allowDiscard ? Function.id : c => c[action]),
            allowDiscard);
        switch (targets) {
            case Zone.TALON:
                await this.$discard({ wizard, card });
            default:
                switch (card && card.play) {
                    case Play.ACTIVATE:
                        await this.$activateEffects({ wizard, card, targets });
                        await this.$discard({ wizard, card });
                        break;
                    case Play.EQUIP:
                        await this.$equip({ wizard, card, targets });
                        break;
                    case Play.EFFECT:
                        await this.$affect({ wizard, card, targets });
                        break;
                }
                break;
        }
    }

    async $discardExpiredEffects({ wizard }) {
        for (const card of wizard.effects.filter(c => c.counter <= 0)) {
            wizard.effects.remove(card);
            await this.$discard({ wizard, card });
        }
    }

    async $drawMissingCards({ wizard }) {
        await this.$draw({ wizard, amount: Math.max(this.config.handSize - wizard.hand.length, 0) });
    }
};

module.exports = Game;
