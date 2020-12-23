module.exports = Object.fromEntries(Object.entries({
    Card: ['AM', 'A', 'AD', 'E', 'S', 'ST', 'O', 'CO', 'CA'],
    Event: ['TURN', 'DRAW', 'DISCARD', 'QUESTION', 'STAT', 'EQUIP', 'AFFECT', 'COUNTER_DECREASE', 'ACTIVATE', 'DEATH', 'END', 'SAVE', 'CANCEL'],
    Calc: ['MUL', 'ADD', 'PL', 'ROLL', 'HP', 'CHOOSE', 'CASTER', 'TARGET', 'SACRIFICE'],
    Targets: ['SELF', 'OTHER', 'OTHERS', 'LEFT', 'RIGHT'],
    Play: ['ACTIVATE', 'EQUIP', 'EFFECT'],
    Zone: ['TALON', 'PILE', 'UNSPECIFIED']
}).map(([key, values]) => [key, values.symbols()]));
