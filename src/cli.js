const { Game, cards, definitions } = require('./core');

(async function() {
    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });

    readline.$question = async (...args) =>
        new Promise(resolve =>
            readline.question(...args, resolve));

    readline.$number = async (str, min, max) => {
        let answer;
        while (
            !Number.isFinite(answer = parseInt(await readline.$question(str))) ||
            answer < min ||
            answer >= max);
        return answer;
    };

    const players = [];
    let name;
    while (name = (await readline.$question("Player ? ")).trim()) {
        players.push(name);
    }

    console.log("Creating game with players", players.join(', '));

    game = new Game({ players, cards: Object.values(cards) });

    game.onEvent(async function(event, { wizard, cards, choices }) {
        console.log(event, [
            wizard && `${ wizard.player } ${ wizard.hitPoints } hp`,
            cards && `cards: ${ cards.map(card => `${card.id}`).join(', ') }`
        ].filter(Function.id).join('; '));
        for (const choice of choices || []) {
        }
        if (choices) {
            console.log(choices.map(([value]) => value.id).join('\n'));
            const choice = await readline.$number("Choice ? ", 0, choices.length);
            const [, subChoices] = choices[choice];
            let subChoice = null;
            if (subChoices?.length) {
                console.log(subChoices.map(([value]) => value.player).join('\n'));
                subChoice = await readline.$number("Subchoice ? ", 0, subChoices.length);
            }
            game.send(wizard.player, choice, subChoice);
        }
        /*switch (event) {
            case
        }*/
    });

    await game.$run();

    readline.close();
})();
