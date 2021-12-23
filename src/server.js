require('../monkey');

function woo(socket) {
    const { Game, cards } = areq('core');

    const game = new Game({ players, cards: Object.values(cards) });

    socket.on('answer', game.send);
    game.onEvent(async function() {
        // SOME transformation
    })

    socket.on('')
}
