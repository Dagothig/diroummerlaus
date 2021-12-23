const { Game, cards } = require('./core');
const util = require('util');
const PASS = Symbol("PASS");

(async function() {
    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });

    readline.$question = async (...args) =>
        new Promise(resolve =>
            readline.question(...args, resolve));

    readline.$number = async (str, min, max) => {
        console.log("Number in range [", min, ",", max, "]");
        let answer;
        while (
            !Number.isFinite(answer = parseInt(await readline.$question(str))) ||
            answer < min ||
            answer > max);
        return answer;
    };

    readline.$choice = async (str, choices) => {
        console.log("Choices", choices);
        let answer;
        do {
            const strAnswer = await readline.$question(str);
            answer = choices.find(choice => choice === strAnswer || choice.description === strAnswer);
        } while (!answer);
        return answer;
    };

    const players = [];
    let name;
    while (name = (await readline.$question("Player ? ")).trim()) {
        players.push(name);
    }

    console.log("Creating game with players", players.join(', '));

    game = new Game({ players, cards: Object.values(cards) });

    game.onEvent(async function(event, payload) {
        console.log(
            event, 
            util.inspect(payload.toEntries().filter(([, v]) => v).toObject(),
            { depth: null }));
        const { wizard, choices, min, max, obligatory } = payload;
        if (choices) {
            const answer = await readline.$choice("Choice ? ", choices
                .map(([k]) => k)
                .concat(obligatory ? [] : [PASS]));
            const [, subChoices] = choices.find(([k]) => k === answer) || [];
            let subAnswer;
            if (subChoices?.length) {
                subAnswer = await readline.$choice("Subchoice ? ", subChoices);
            }
            game.send(wizard, answer === PASS ? null : answer, subAnswer);
        }
        if (min || max) {
            const answer = await readline.$number("Choice ? ", min, max);
            game.send(wizard, answer);
        }
        /*switch (event) {
            case
        }*/
    });

    await game.$run();

    readline.close();
})();
