module.exports = {
    CardTypes: ['AM', 'A', 'AD', 'E', 'S', 'ST', 'O', 'CO', 'CA'].symbols(),
    EventTypes: ['DRAW', 'QUESTION', 'PLAY', 'DAMAGE'].symbols(),
    Calc: ['MUL', 'ADD', 'PL', 'ROLL', 'HP', 'CHOOSE', 'DMG', 'SACRIFICE', 'CASTER', 'TARGET'].symbols(),
    Fns: ['CASTER', 'TARGET'],
    Targets: ['SELF', 'OTHER', 'OTHERS', 'LEFT', 'RIGHT'].symbols(),
    Events: [
        'ALL',
        'TURN',
        'DRAW_MISSING',
        'COUNTER_DECREASE',
        'ACTIVATE_EFFECTS',
        'PLAY_CARD',
        'DISCARD_EXPIRED_EFFECTS',
        'PLAY',
        'DISCARD',
        'EQUIP',
        'EFFECT',
        'DRAW',
        'CARD',
        'DAMAGE',
        'HEAL',
    ].symbols()
};
