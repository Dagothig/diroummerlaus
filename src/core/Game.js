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
        '$chooseAndPlayCard',
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
            async $stat(key) {
                return game.config[key] +
                    (await $.all(this.effects.concat(this.equip)
                        .map(c => game.$calc(c[key], { wizard: this }))))
                    .sum();
            },
            flag(key) {
                return (
                    this.effects.find(e => e[key]) ||
                    this.equip.find(e => e[key]));
            },
            player,
            hitPoints: game.config.hitPoints,
            hand: [],
            equip: [],
            effects: [],
            isAlive: true,
            get maxHitPoints() { return game.config.hitPoints },
            get $powerLevel() { return this.$stat('powerLevel'); },
            get $savingThrow() { return this.$stat('savingThrow'); },
            get untargettable() { return this.flag('untargettable') },
            get inactive() { return this.flag('inactive'); }
        })));

        this.pile = this.rng.shuffle(cards.map(c => ({ ...Game.cardTypes[c.type], ...c })));
        this.talon = [];
        this.questions = [];
    }

    onEvent(listener) {
        this.listeners.push(listener);
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
        /*console.log("$ask");
        console.trace();
        console.log(question.wizard.player, question.choices);*/
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
                const [answer, subChoices] = question.choices.find(([primary]) => choice === primary) || [];
                const subAnswer = subChoices?.find(secondary => subChoice === secondary);
                return (!(subChoices?.length) || subAnswer) && question.resolve([answer, subAnswer]);
            }
            return question.min <= choice && choice <= question.max && question.resolve([choice]);
        }
        !question.obligatory && question.resolve([]);
    }

    async $askCard({ wizard, cards, ...question }) {
        const [cardId] = await this.$ask({ wizard, choices: cards.map(c => [c.id, []]), ...question });
        return cardId && cards.find(c => c.id === cardId);
    }

    targets(wizard, card, targetId) {
        const target = this.wizards.find(w => w.player === targetId);
        return target ?
            [target] :
            (card?.target === Targets.OTHERS && targetId === Zone.UNSPECIFIED ?
                this.wizards.filter(w => w.isAlive && w !== wizard && !w.untargettable) :
                targetId);
    }

    targetIds(wizard, card) {
        switch (card?.target) {
            case Targets.SELF:
                return [wizard];
            case Targets.OTHER:
                return this.wizards
                    .filter(w => w.isAlive && w !== wizard && !w.untargettable);
            case Targets.OTHERS:
                return [Zone.UNSPECIFIED];
            case Targets.LEFT:
                return [this.wizards.findFrom(wizard.turn + 1, w => w.isAlive)]
                    .filter(w => !w.untargettable);
            case Targets.RIGHT:
                return [this.wizards.findFrom(wizard.turn - 1, w => w.isAlive, -1)]
                    .filter(w => !w.untargettable);
            default:
                return [];
        }
    }

    async $askCardWithTarget({ wizard, cards, allowDiscard, ...question }) {
        if (wizard.inactive) return [];
        const [cardId, targetId] = await this.$ask({
            wizard,
            choices: cards.map(c => [c.id, [
                ...this.targetIds(wizard, c).map(t => t.player || t),
                ...allowDiscard ? [Zone.TALON] : []
            ]]),
            ...question
        });
        const card = cards.find(c => c.id === cardId);
        const targets = this.targets(wizard, card, targetId);
        return [card, targets];
    }

    async $askNumber({ wizard, number }) {
        return this.$ask({ wizard, min: 1, max: number })[0];
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
                    case Calc.PL: return (await $.all(args.map(n => n.$powerLevel))).sum();
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
                    case Calc.PL: return await wizard.$powerLevel;
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
            const [reactCard, reactTargets] = await this.$askCardWithTarget({
                wizard: target,
                action: 'react',
                cards: target.hand.filter(c =>
                    (card.canCancel && c.cancel) ||
                    (card.canRedirect && c.redirect) ||
                    (card.canResist && c.react))
            });

            cancel:
            if (card.canCancel && reactCard?.cancel) {
                const cancelCards = [reactCard];
                for (let i = 1; i < card.canCancel; i++) {
                    const cancelCard = await this.$askCard({
                        wizard: target,
                        cards: target.hand.filter(c => !cancelCards.includes(c) && c.cancel)
                    });
                    if (!cancelCard) break cancel;
                    cancelCards.push(cancelCard);
                }
                this.event(Event.CANCEL, { wizard, targets: [target], card, cards: cancelCards });
                for (const cancelCard of cancelCards)
                    await this.$discard({ wizard: target, card: cancelCard });
                return;
            }

            if (card.canRedirect && reactCard?.redirect) {
                await this.$discard({ wizard: target, card: reactCard });
                target = wizard;
            }

            if (card.canResist && reactCard?.react) {
                await this.$playCard({ wizard: target, card: reactCard, targets: reactTargets });
            }

            if (card.draw) {
                const draw = await this.$calc(card.draw, { wizard, card, target, sacrifice });
                await this.$draw({ wizard: target, amount: draw });
            }

            const $targetSavingThrow = target.$savingThrow;
            const $cardSavingThrow = this.$calc(card.savingThrow, { wizard, card, target, sacrifice });
            const savingThrow = await $targetSavingThrow + await $cardSavingThrow;
            let save = 1;
            if (!target.inactive && card.canSave && this.roll(1, 20) <= savingThrow) {
                save = card.canSave === true ? 0 : card.canSave;
                this.event(Event.SAVE, { wizard, targets: [target], card, save });
            }

            if (card.damage) {
                const damageCalc = await this.$calc(card.damage, { wizard, card, target, sacrifice });
                const absorb =
                    (await $.all(target.equip
                        .filter(c => c.absorb)
                        .map(c => this.$calc(c.absorb, { wizard: target, card: c }))))
                    .sum();
                const damage = Math.max(Math.ceil(damageCalc * save) - absorb, 0);
                this.stat(target, 'hitPoints', -damage);
                if (card.lifesteal) {
                    this.stat(wizard, 'hitPoints', damage);
                }
            }

            if (card.heal) {
                const heal =
                    (await this.$calc(card.heal, { wizard, card, target, sacrifice })) *
                    save;
                this.stat(target, 'hitPoints', heal);
            }

            for (let i = 0; i < card.haste; i++) {
                await this.$chooseAndPlayCard({ wizard: target });
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

    async $effect({ wizard, card, targets }) {
        wizard.hand.remove(card);
        this.event(Event.EFFECT, { wizard, card, targets });

        await $.all(targets.map(async target => {
            const [reactCard, reactTargets] = await this.$askCardWithTarget({
                wizard: target,
                action: 'react',
                cards: target.hand.filter(c =>
                    (card.canCancel && c.cancel) ||
                    (card.canRedirect && c.redirect) ||
                    (card.canResist && c.react))
            });

            cancel:
            if (card.canCancel && reactCard?.cancel) {
                const cancelCards = [reactCard];
                for (let i = 1; i < card.canCancel; i++) {
                    const cancelCard = await this.$askCard({
                        wizard: target,
                        cards: target.hand.filter(c => !cancelCards.includes(c) && c.cancel)
                    });
                    if (!cancelCard) break cancel;
                    cancelCards.push(cancelCard);
                }
                this.event(Event.CANCEL, { wizard, targets: [target], card, cards: cancelCards });
                for (const cancelCard of cancelCards)
                    await this.$discard({ wizard: target, card: cancelCard });
                return;
            }

            if (card.canRedirect && reactCard?.redirect) {
                await this.$discard({ wizard: target, card: reactCard });
                target = wizard;
            }

            if (card.canResist && reactCard?.react) {
                await this.$playCard({ wizard: target, card: reactCard, targets: reactTargets });
            }

            const $targetSavingThrow = target.$savingThrow;
            const $cardSavingThrow = this.$calc(card.savingThrow, { wizard, card, target });
            const savingThrow = await $targetSavingThrow + await $cardSavingThrow;
            if (!target.inactive && card.canSave && this.roll(1, 20) <= savingThrow) {
                this.event(Event.SAVE, { wizard, targets: [target], card });
                return;
            }

            target.effects.push(card);
        }));
    }

    stat(wizard, stat, amount) {
        const max = wizard['max' + stat.pascal()] || Number.MAX_VALUE;
        const min = 0;
        const currentStat = wizard[stat];
        const newStat = Math.min(Math.max(currentStat + amount, min), max);
        wizard[stat] = newStat;
        this.event(Event.STAT, { wizard, [stat]: newStat - currentStat });
    }

    async $playCard({ wizard, card, targets }) {
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
                        await this.$effect({ wizard, card, targets });
                        break;
                }
                break;
        }
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
            cards: wizard.effects.filter(e => e.activate)
        });
        if (card) {
            await this.$activateCard({ wizard, card, targets });
        }
    }

    async $chooseAndPlayCard({ wizard }) {
        const [card, targets] = await this.$askCardWithTarget({
            wizard,
            cards: wizard.hand,
            allowDiscard: true,
            obligatory: true
        });
        if (card) {
            await this.$playCard({ wizard, card, targets });
        }
    }

    async $discardExpiredEffects({ wizard }) {
        for (const card of wizard.effects.filter(c => c.counter <= 0)) {
            wizard.effects.remove(card);
            await this.$discard({ wizard, card });
        }
    }

    async $drawMissingCards({ wizard }) {
        if (wizard.inactive) return;
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
