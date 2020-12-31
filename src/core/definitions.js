module.exports = Object.entries({
    Card: ['AM', 'A', 'AD', 'E', 'S', 'ST', 'O', 'CO', 'CA', 'SP'],
    Event: ['TURN', 'DRAW', 'DISCARD', 'QUESTION', 'STAT', 'EQUIP', 'EFFECT', 'COUNTER_DECREASE', 'ACTIVATE', 'DEATH', 'END', 'SAVE', 'CANCEL', 'STEAL', 'RESHUFFLE'],
    Calc: ['MUL', 'ADD', 'SUB', 'PL', 'ROLL', 'HP', 'CHOOSE', 'CASTER', 'TARGET', 'SACRIFICE', 'ALIVE'],
    Targets: ['SELF', 'OTHER', 'OTHERS', 'LEFT', 'RIGHT', 'ANY'],
    Play: ['ACTIVATE', 'EQUIP', 'EFFECT'],
    Zone: ['TALON', 'UNSPECIFIED'],
    Item: ['CHOOSE', 'ALL', 'EQUIPPED', 'RING', 'ROBE', 'EXCEPT']
})
.map(([key, values]) => [key, values.symbols()])
.toObject();
