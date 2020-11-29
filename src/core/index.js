require('../monkey');

module.exports = Object.fromEntries([
    'Game',
    'cards',
    'definitions'
].map(path => [path, require('./' + path)]));
