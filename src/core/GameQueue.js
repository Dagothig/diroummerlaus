const { Event } = require('./definitions');
const AsyncQueue = require('./AsyncQueue');

module.exports = class GameQueue extends AsyncQueue {
    constructor(game) {
        super();
        this.$type = this.$type.bind(this);
        this.$answer = this.$answer.bind(this);
        this.game = game;
        this.game.onEvent((t, p) => this.enqueue([t, p]));
    }

    async $type(eventType) {
        return (await this.$find(([type]) => type === eventType))[1];
    }

    async $answer(...args) {
        await this.$type(Event.QUESTION);
        this.game.send(...args);
    }
}
