const {
    Card,
    Event,
    Calc,
    Targets,
    Play,
    Zone,
    Question
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

    static turnPhases = [
        '$counterDecrease',
        '$activateEffects',
        '$playCard',
        '$discardExpiredEffects',
        '$drawMissingCards'
    ]

    constructor({ config, cards, players, rng = Math }) {
        const game = this;
        this.rng = rng;
        this.listeners = [];
        this.config = { ...Game.defaultConfig, ...config };
        this.rng = rng;
        this.wizards = this.rng.shuffle(players.map((player, i) => ({
            turn: i,
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
            isAlive: true,
            get maxHitPoints() { return game.config.hitPoints },
            get powerLevel() { return this.stat('powerLevel'); },
            get savingThrow() { return this.stat('savingThrow'); }
        })));

        this.pile = this.rng.shuffle(cards.map(c => ({ ...Game.cardTypes[c.type], ...c })));
        this.talon = [];
        this.questions = [];
    }

    onEvent(listener) {
        this.listeners.push(listener);
    }

    unEvent(listener) {
        this.listeners.remove(listener);
    }

    event(type, { wizard, cards, card, choices, targets, winners, hitPoints }) {
        const payload = {
            wizard: wizard?.player,
            cards: cards?.map(({ id }) => id),
            card: card?.id,
            targets: targets?.map(({ player }) => player),
            winners: winners?.map(({ player }) => player),
            choices,
            hitPoints
        };
        this.listeners.forEach(l => l(type, payload));
    }

    async $ask(question) {
        if (question.choices && !question.choices.length) {
            return [];
        }
        const $promise = new $(res => question.resolve = res)
            .then(n => (this.questions.remove(question), n));
        this.questions.push(question);
        this.event(Event.QUESTION, question);
        return $promise;
    }

    send(player, choice, subChoice) {
        const question = this.questions.find(question => question.wizard.player === player);
        if (!question) return;
        if (choice) {
            if (question.choices) {
                const [answer, subChoices] = question.choices.find(([primary]) => choice === primary);
                const subAnswer = subChoices?.find(secondary => subChoice === secondary);
                !subChoice || subAnswer && question.resolve([answer, subAnswer]);
            }
            question.min <= choice && choice <= question.max && question.resolve(choice);
        }
        !question.obligatory && question.resolve();
    }

    async $askCard({ wizard, cards, ...question }) {
        const [cardId] = await this.$ask({ wizard, choices: cards.map(c => [c.id, []]), ...question });
        return cards.find(c => c.id === cardId);
    }

    targets(wizard, card, targetId) {
        switch (card && card.target) {
            case Targets.SELF:
                return [wizard];
            case Targets.OTHER:
                return [this.wizards.find(w => w.player === targetId)];
            case Targets.OTHERS:
                return this.wizards.filter(w => w.isAlive).except(wizard);
            case Targets.LEFT:
                return [this.wizards.findFrom(wizard.turn - 1, w => w.isAlive, -1)];
            case Targets.RIGHT:
                return [this.wizards.findFrom(wizard.turn + 1, w => w.isAlive)];
            default:
                return targetId;
        }
    }

    async $askCardWithTarget({ wizard, cards, action, allowDiscard, ...question }) {
        const filter = allowDiscard ? Function.id : c => c[action];
        const [cardId, targetId] = await this.$ask({
            wizard,
            choices: cards.filter(filter).map(c => [c.id, [
                ...c[action] ?
                        c.target === Targets.OTHER ?
                            this.wizards.filter(w => w.isAlive).except(wizard).map(w => w.player) :
                            [Zone.UNSPECIFIED] :
                    [],
                ...allowDiscard ?
                    [Zone.TALON] :
                    []
            ]]),
            ...question
        });
        const card = cards.find(c => c.id === cardId);
        const targets = this.targets(wizard, card, targetId);
        return [card, targets];
    }

    async $askNumber({ wizard, number }) {
        return this.$ask({ wizard, min: 1, max: number });
    }

    roll(amount, sides) {
        return this.rng.dice(amount, sides);
    }

    async _$calc(value, env) {
        const { wizard, target, sacrifice = 0 } = env;
        switch (typeof value) {
            case 'object':
                const args = await $.all(value.slice(1).map(n => this._$calc(n, env)));
                switch (args.length && value[0]) {
                    case Calc.MUL: return args.prod();
                    case Calc.ADD: return args.sum();
                    case Calc.ROLL: return this.roll.apply(this, args);
                    case Calc.HP: return args.sum(n => n.hitPoints);
                    case Calc.PL: return args.sum(n => n.powerLevel);
                    case Calc.CHOOSE:
                        // TODO - Support choosing other things than numbers.
                        return (
                            (await $.all(args.map(n => this.$askNumber({ wizard, number: n }))))
                            .sum());
                    default: return await this._$calc(value[0], env);
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

    async $calc(value, env) {
        return Math.ceil(await this._$calc(value, env));
    }

    async $activateCard({ wizard, card, targets }) {
        this.event(Event.ACTIVATE, { wizard, card, targets });
        const sacrifice = await this.$calc(card.sacrifice, { wizard, card, targets });
        if (sacrifice) {
            this.stat(wizard, 'hitPoints', -sacrifice);
        }

        await $.all(targets.map(async target => {
            cancel: if (card.canCancel) {
                const cancelCards = [];
                for (let i = 0; i < card.canCancel; i++) {
                    const cancelCard = await this.$askCard({
                        wizard: target,
                        cards: target.hand.except(cancelCards).filter(c => c.cancel)
                    });

                    if (!cancelCard) break cancel;
                    cancelCards.push(cancelCard);
                }
                if (cancelCards.length) {
                    await this.$discard({ wizard: target, cards: cancelCards });
                    return;
                }
            }

            if (card.canRedirect) {
                const redirectCard = await this.$askCard({
                    wizard: target,
                    cards: target.hand.filter(c => c.redirect)
                });

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
        this.event(Event.EQUIP, { wizard, card, targets });
    }

    async $affect({ wizard, card, targets }) {
        wizard.hand.remove(card);
        targets.forEach(target => target.effects.push(card));
        this.event(Event.AFFECT, { wizard, card, targets });
    }

    stat(wizard, stat, amount) {
        wizard[stat] += amount;
        this.event(Event.STAT, { wizard, [stat]: amount });
    }

    async $run() {
        await $.all(this.wizards.map(wizard => this.$drawMissingCards({ wizard })));
        let turn = this.wizards.length - 1;
        while (turn !== (turn = this.wizards.findIndexFrom(turn + 1, wizard => wizard.isAlive))) {
            const wizard = this.wizards[turn];
            this.event(Event.TURN, { wizard });
            for (const phase of Game.turnPhases) {
                await this[phase]({ wizard });
                await this.$checkDeaths();
            }

            // TODO this condition is shyte
            if (this.wizards.every(w => !w.hand.length) && !this.pile.length) {
                break;
            }
        }
        this.event(Event.END, { winners: this.wizards.filter(w => w.isAlive) });
    }

    async $counterDecrease({ wizard }) {
        wizard.effects.forEach(effect => effect.counter--);
    }

    async $activateEffects({ wizard }) {
        const [card, targets] = await this.$askCardWithTarget({
            wizard,
            action: 'activate',
            cards: wizard.effects
        });
        if (card) {
            await this.$activateCard({ wizard, card, targets });
        }
    }

    async $playCard({ wizard, action = 'play', allowDiscard = true }) {
        const [card, targets] = await this.$askCardWithTarget({
            wizard,
            action,
            cards: wizard.hand,
            allowDiscard,
            obligatory: true
        });
        switch (targets) {
            case Zone.TALON:
                await this.$discard({ wizard, card });
                break;
            default:
                switch (card && card.play) {
                    case Play.ACTIVATE:
                        await this.$activateCard({ wizard, card, targets });
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

    async $checkDeaths() {
        for (const wizard of this.wizards.filter(w => w.isAlive && w.hitPoints <= 0)) {
            wizard.isAlive = false;
            this.event(Event.DEATH, { wizard });
        }
    }
};

module.exports = Game;
