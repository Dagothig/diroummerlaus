const test = require('ava');
const {
    cards,
    definitions: {
        CardTypes,
        EventTypes,
        Calc,
        Fns,
        Targets,
        Events
    }
} = require('.');
const Game = require('./Game-ecs');
const AsyncQueue = require('./AsyncQueue');

test('Game pretends to handle all event types', t => {
    const game = new Game({ players: [], cards: [], config: {} });
    Object.values(Events).forEach(type =>
        t.truthy(game.transformers[type], `${ type.toString() } is not defined`));
});
