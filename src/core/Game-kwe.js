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

class Game {
    constructor({ config, cards, players }) {
        this.pile = cards.shuffle();
        this.talon = [];
    }

    async ask() {

    }

    async askCard() {

    }

    async askCardWithTarget() {

    }

    async askNumber() {

    }

    async send() {

    }

    async calc(value, { wizard, card, targets, sacrifice }) {
        switch (typeof value) {
            case 'number':
                return value;
            case 'object':
            case 'symbol':
                switch (value) {
                    case Calc.MUL:
                    case Calc.ADD:
                    case Calc.ROLL:
                    case Calc.HP:
                    case Calc.PL:
                    case Calc.CHOOSE:

                    case Calc.CASTER:
                        return wizard;
                    case Calc.TARGET:
                        return targets;
                    case Calc.SACRIFICE:
                        return sacrifice;
                }
            default:
                return 0;
        }
    }

    async activateCard({ wizard, card, targets }) {
        if (card.draw) {

        }

        let sacrifice = this.calc(card.sacrifice, { wizard, card, targets });
        if (sacrfice) {

        }

        let damage = this.calc(card.damage, { wizard, card, targets, sacrifice });
        if (damage) {

        }

        let heal = this.calc(card.heal, { wizard, card, targets, sacrifice });
        if (heal) {

        }
    }

    async draw({ wizard }) {
        wizard.hand.push(...this.pile.take());
    }

    async discard({ wizard, card }) {
        wizard.hand.remove(card) || wizard.effects.remove(card) || wizard.equip.remove(card);
        this.talon.push(card);
    }

    async equip({ wizard, card, targets }) {
        wizard.hand.remove(card);
        targets.forEach(target => target.equip.push(card));
    }

    async affect({ wizard, card, targets }) {
        wizard.hand.remove(card);
        targets.forEach(target => target.effects.push(card));
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

    async counterDecrease({ wizard }) {
        wizard.effects.forEach(effect => effect.counter--);
    }

    async activateEffects({ wizard }) {
        const [card, targets] = await this.askCardWithTarget(wizard.effects.filter(c => c.activate));
        await this.activateCard({ wizard, card, targets });
    }

    async playCard() {
        const [card, targets] = await this.askCardWithTarget(wizard.hand.filter(c => c.play));
        switch (card.play) {
            case Play.ACTIVATE:
                await this.activateEffects({ wizard, card, targets });
                await this.discard({ wizard, card });
                break;
            case Play.EQUIP:
                await this.equip({ wizard, card, targets });
                break;
            case Play.EFFECT:
                await this.affect({ wizard, card, targets });
                break;
        }
    }

    async discardExpiredEffects({ wizard }) {
        for (const card of wizard.effects.filter(c => c.counter <= 0)) {
            wizard.effects.remove(card);
            await this.discard({ wizard, card });
        }
    }

    async drawMissingCards({ wizard }) {
        while (wizard.hand.length < this.config.handSize) {
            await this.draw({ wizard });
        }
    }
};
