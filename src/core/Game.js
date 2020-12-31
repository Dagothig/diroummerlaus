const { Card, Event, Calc, Targets, Play, Zone, Item } = require('./definitions');

class Game {
    static defaultConfig = {
        powerLevel: 1,
        savingThrow: 10,
        hitPoints: 50,
        handSize: 5,
        itemLimits: {
            [Item.RING]: 2,
            [Item.ROBE]: 1,
        }
    };

    static cardTypes = {
        [Card.AM]: { target: Targets.OTHERS, play: Play.ACTIVATE },
        [Card.A]: { target: Targets.SELF, play: Play.ACTIVATE },
        [Card.AD]: { target: Targets.OTHER, play: Play.ACTIVATE },
        [Card.O]: { target: Targets.SELF, play: Play.EQUIP },
        [Card.E]: { play: Play.ACTIVATE },
        [Card.S]: { play: Play.ACTIVATE },
        [Card.ST]: { play: Play.ACTIVATE },
        [Card.O]: { target: Targets.SELF, play: Play.EQUIP },
        [Card.CO]: { target: Targets.OTHER, play: Play.ACTIVATE },
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
                return (game.config[key] || 0) +
                    await this.effects.concat(this.equip)
                        .$sum(c => game.$calc(c[key], { wizard: this }))
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
            get $absorb() { return this.$stat('absorb'); },
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
        if (!question.choices?.length && !question.max) {
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
                const [answer, subChoices] = question.choices.find(([c]) => choice === c) || [];
                if (!answer && question.obligatory) return;
                const subAnswer = subChoices?.find(secondary => subChoice === secondary);
                return (!(subChoices?.length) || subAnswer) && question.resolve([answer, subAnswer]);
            }
            return question.min <= choice && choice <= question.max && question.resolve([choice]);
        }
        !question.obligatory && question.resolve([]);
    }

    async $askCard({ wizard, cards, ...question }) {
        if (cards.length === 1 && question.obligatory) return cards[0]
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
        return (await this.$ask({ wizard, min: 1, max: number }))[0];
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
                    case Calc.PL: return args.$sum(n => n.$powerLevel);
                    case Calc.CHOOSE: return args.$sum(n =>
                        this.$askNumber({ wizard, number: n, obligatory: true }));
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
                    case Calc.ALIVE: return this.wizards.filter(w => w.isAlive).length;
                    default: return 0;
                }
            case 'number': return value;
            default: return 0;
        }
    }

    async $calc(value, env) {
        return Math.ceil(await this._$calc(value, env));
    }

    async $items(value, env) {
        const { wizard, target } = env;
        switch (typeof value) {
            case 'object':
                const args = await $.all(value.slice(1).map(n => this.$items(n, env)));
                switch (args.length && value[0]) {
                    case Item.CHOOSE:
                        return [await this.$askCard({ wizard, cards: args.flat(), obligatory: true })];
                    case Item.ALL:
                        return args.flat();
                    case Item.EXCEPT:
                        return args[0].except(...args.slice(1).flat());
                    default: return args.flat().filter(c => c.item === value[0]);
                }
            case 'symbol':
                switch (value) {
                    case Item.CHOOSE:
                        return this.$items([Item.CHOOSE, Item.ALL], env);
                    case Item.ALL:
                        return target.hand.concat(target.equip).concat(target.effects);
                    case Item.EQUIPPED:
                        return target.equip.slice();
                    case Item.RING:
                        return target.equip.filter(c => c.item === Item.RING);
                    case Item.ROBE:
                        return target.equip.filter(c => c.item === Item.ROBE);
                    default: [];
                }
            default: return [];
        }
    }

    async $react({ wizard, card, target, multiplier = 1 }) {
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
            await this.$discard({ wizard: target, cards: cancelCards });
            return { cancelled: true };
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
            multiplier *= card.canSave === true ? 0 : card.canSave;
            this.event(Event.SAVE, { wizard, targets: [target], card });
        }

        return { target, multiplier };
    }

    async $activateCard({ wizard, card, targets, multiplier }) {
        this.event(Event.ACTIVATE, { wizard, card, targets });

        const sacrifice = await this.$calc(card.sacrifice, { wizard, card, targets });
        sacrifice && this.stat(wizard, 'hitPoints', -sacrifice);

        await $.all(targets.map(async target => {
            const react = await this.$react({ wizard, card, target, multiplier });
            if (react.cancelled) return;
            target = react.target;
            multiplier = react.multiplier;

            if (card.damage) {
                const damageCalc = await this.$calc(card.damage, { wizard, card, target, sacrifice });
                const absorb = await target.$absorb;
                const damage = Math.max(Math.ceil(damageCalc * multiplier) - absorb, 0);
                this.stat(target, 'hitPoints', -damage);
                card.lifesteal && this.stat(wizard, 'hitPoints', damage);
                card.acid && damage && this.roll(1, 6) === 1 && this.$discard({
                    wizard: target,
                    cards: await this.$items(
                        [Item.CHOOSE, Item.EQUIPPED],
                        { wizard, card, target, sacrifice })
                });
            }

            card.heal && this.stat(
                target,
                'hitPoints',
                (await this.$calc(card.heal, { wizard, card, target, sacrifice })) * multiplier);

            for (let i = 0; i < card.haste; i++)
                await this.$chooseAndPlayCard({ wizard: target });

            for (let i = 0; i < card.combo?.count; i++)
                await this.$playCard({
                    wizard,
                    card: await this.$askCard({
                        wizard,
                        cards: wizard.hand.filter(c => !card.combo.type || c.type === card.combo.type),
                        obligatory: true
                    }),
                    targets: [target],
                    multiplier: card.combo.multiplier || 1
                });

            card.remove && this.$discard({
                wizard: target,
                cards: await this.$items(card.remove, { wizard, card, target, sacrifice })
            });

            card.steal && this.$steal({
                wizard,
                target,
                cards: await this.$items(card.steal, { wizard, card, target, sacrifice })
            });

            card.desintegrate && this.$death({ wizard: target });

            if (card.transferBodies) {
                const wizardPlayer = wizard.player;
                const targetPlayer = target.player;
                wizard.player = targetPlayer;
                target.player = wizardPlayer;
            }
        }));

        if (card.reshuffle) {
            const cards = this.talon.take(this.talon.length);
            this.pile.push(...this.rng.shuffle(cards));
            this.event(Event.RESHUFFLE, { wizard, cards });
        }
    }

    async $draw({ wizard, amount }) {
        const cards = this.pile.take(amount);
        wizard.hand.push(...cards);
        this.event(Event.DRAW, { wizard, cards });
    }

    async $discard({ wizard, card, cards = [] }) {
        card && (cards = [...cards, card]);
        cards.forEach(c => {
            wizard.hand.remove(c) || wizard.effects.remove(c) || wizard.equip.remove(c);
            this.talon.push(c);
            this.event(Event.DISCARD, { wizard, card: c });
        });
    }

    async $steal({ wizard, target, card, cards = [] }) {
        card && (cards = [...cards, card]);
        cards.forEach(c => {
            target.hand.remove(c) || target.effects.remove(c) || target.equip.remove(c);
            wizard.hand.push(c);
            this.event(Event.STEAL, { wizard, targets: [target], card: c });
        })
    }

    async $equip({ wizard, card, targets }) {
        wizard.hand.remove(card);
        await $.all(targets.map(async target => {
            if (card.item && card.item in this.config.itemLimits) {
                const sameType = target.equip.filter(c => c.item === card.item);
                sameType.length >= this.config.itemLimits[card.item] && this.$discard({
                    wizard: target,
                    card: await this.$askCard({ wizard: target, cards: sameType, obligatory: true }),
                });
            }
            target.equip.push(card);
        }));
        this.event(Event.EQUIP, { wizard, card, targets });
    }

    async $effect({ wizard, card, targets }) {
        wizard.hand.remove(card);
        this.event(Event.EFFECT, { wizard, card, targets });

        await $.all(targets.map(async target => {
            const { target: newTarget, cancelled, multiplier } = await this.$react({ wizard, card, target });
            if (cancelled || !multiplier) return;
            target = newTarget;
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

    async $playCard({ wizard, card, targets, multiplier = 1 }) {
        switch (card?.play) {
            case Play.ACTIVATE:
                await this.$activateCard({ wizard, card, targets, multiplier });
                await this.$discard({ wizard, card });
                break;
            case Play.EQUIP:
                await this.$equip({ wizard, card, targets });
                break;
            case Play.EFFECT:
                await this.$effect({ wizard, card, targets });
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
                if (!wizard.isAlive) break;
            }

            // TODO this condition is shyte
            if (this.wizards.every(w => !w.hand.length) && !this.pile.length) {
                break;
            }
        }
        this.event(Event.END, { winners: this.wizards.filter(w => w.isAlive) });
    }

    async $counterDecrease({ wizard }) {
        wizard.effects.forEach(effect => 'counter' in effect && effect.counter--);
    }

    async $activateEffects({ wizard }) {
        // TODO - The current data structure really doesn't support this well.
    }

    async $chooseAndPlayCard({ wizard }) {
        const [card, targets] = await this.$askCardWithTarget({
            wizard,
            cards: wizard.hand,
            allowDiscard: true,
            obligatory: true
        });
        if (targets === Zone.TALON) {
            await this.$discard({ wizard, card });
        } else {
            await this.$playCard({ wizard, card, targets });
        }
    }

    async $discardExpiredEffects({ wizard }) {
        for (const card of wizard.effects.filter(c => c.counter <= 0)) {
            await this.$discard({ wizard, card });
        }
    }

    async $drawMissingCards({ wizard }) {
        if (wizard.inactive) return;
        await this.$draw({ wizard, amount: Math.max(this.config.handSize - wizard.hand.length, 0) });
    }

    async $checkDeaths() {
        for (const wizard of this.wizards.filter(w => w.isAlive && w.hitPoints <= 0)) {
            const resurrect = wizard.equip.concat(wizard.effects).find(c => c.resurrect);
            if (resurrect) {
                this.stat(wizard, 'hitPoints', wizard.maxHitPoints - wizard.hitPoints);
                await this.$discard({ wizard, cards: wizard.hand, card: resurrect });
                await this.$drawMissingCards({ wizard });
                continue;
            }
            await this.$death({ wizard });
        }
    }

    async $death({ wizard }) {
        wizard.isAlive = false;
        for (const card of await this.$items(Item.ALL, { target: wizard }))
            this.$discard({ wizard, card });
        this.event(Event.DEATH, { wizard });
    }
};

module.exports = Game;
