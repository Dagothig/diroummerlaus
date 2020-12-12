module.exports = Object.fromEntries(Object.entries({
    CardTypes: ['AM', 'A', 'AD', 'E', 'S', 'ST', 'O', 'CO', 'CA'],
    EventTypes: ['DRAW', 'QUESTION', 'PLAY', 'DAMAGE'],
    Calc: ['MUL', 'ADD', 'PL', 'ROLL', 'HP', 'CHOOSE', 'CASTER', 'TARGET'],
    Fns: ['CASTER', 'TARGET'],
    Targets: ['SELF', 'OTHER', 'OTHERS', 'LEFT', 'RIGHT'],
    Play: ['ACTIVATE', 'EQUIP', 'EFFECT'],
    Control: ['CONTINUE'],
    Events: [
        'ALL',
        'TURN',
        'DRAW_MISSING',
        'COUNTER_DECREASE',
        'ACTIVATE_EFFECTS',
        'PLAY_CARD',
        'DISCARD_EXPIRED_EFFECTS',
        'DISCARD',
        'EQUIP',
        'EFFECT',
        'DRAW',
        'CARD',
        'DAMAGE',
        'HEAL',
        'SACRIFICE',
        'CALC',
        'STAT'
    ]
}).map(([key, values]) => [key, values.symbols()]));
