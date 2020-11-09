const test = require('ava');
require('./monkey');

test('Array#gen', t => {
    t.deepEqual(Array.gen(3, Function.id), [0, 1, 2]);
});

test('Array#remove', t => {
    const arr = ['a', 'b', 'c'];

    t.true(arr.remove('a'));
    t.deepEqual(arr, ['b', 'c']);

    t.false(arr.remove('d'));
    t.deepEqual(arr, ['b', 'c']);
});

test('Array#shuffle', t => {
    const arr = ['a', 'b', 'c'];

    t.assert(arr.shuffle() instanceof Array);
});

test('Array#ni', t => {
    const arr = ['a', 'b', 'c'];

    t.is(arr.ni(), 'c');
    t.is(arr.ni(0), 'c');
    t.is(arr.ni(1), 'b');
    t.is(arr.ni(2), 'a');
    t.is(arr.ni(3), undefined);
});

test('Array#take', t => {
    const arr = ['a', 'b', 'c', 'd'];

    t.deepEqual(arr.take(2), ['c', 'd']);
    t.deepEqual(arr.take(3), ['a', 'b']);
    t.deepEqual(arr.take(1), []);
});

test('Array#symbols', t => {
    t.deepEqual(
        Object.entries(['a', 'b', 'c'].symbols())
            .map(([key, value]) => [key, value.toString()]),
        [
            ['a', 'Symbol(a)'],
            ['b', 'Symbol(b)'],
            ['c', 'Symbol(c)']
        ]);

    t.deepEqual(
        Object.entries(
            [
                { name: 'a' },
                { name: 'b' },
                { name: 'c' }
            ]
            .symbols(x => x.name)
        )
            .map(([key, value]) => [key, value.toString()]),
        [
            ['a', 'Symbol(a)'],
            ['b', 'Symbol(b)'],
            ['c', 'Symbol(c)']
        ]);
});

test('Array#findIndexFrom', t => {
    const arr = ['a1', 'b', 'c', 'a2', 'e'];
    t.is(arr.findIndexFrom(2, n => n[0] === 'a'), 3);
    t.is(arr.findIndexFrom(4, n => n[0] === 'a'), 0);
    t.is(arr.findIndexFrom(5, n => n[0] === 'a'), 0);
    t.is(arr.findIndexFrom(4, (_, i) => i === 3), 3);
});

test('Array#findEntry', t => {
    const arr = ['a', 'b', 'c'];
    t.deepEqual(arr.findEntry(v => v === 'b'), [1, 'b']);
});

test('Array#except', t => {
    t.deepEqual(['a', 'b', 'c'].except('b'), ['a', 'c']);
});

test('Math#clip', t => {
    t.is(Math.clip(1, 3, 5), 3);
    t.is(Math.clip(4, 3, 5), 4);
    t.is(Math.clip(6, 3, 5), 5);
});

test('Math#randint', t => {
    const n = 10000;
    const occurences = { 1: 0, 2: 0, 3: 0 };
    for (let i = 1; i < n; i++) {
        occurences[Math.randint(1, 3)]++;
    }

    Object.values(occurences).forEach(occ => t.is(occ > n / 4, true));
});

test('Math#dice', t => {
    const n = 1000;
    let total = 0;
    for (let i = 1; i < n; i++) {
        t.true(Math.dice(2, 4) <= 8);
        t.true(Math.dice(2, 4) >= 2);
        total += Math.dice(4, 6);
    }
    const avg4d6 = total / n;
    const exp = 4 * (1 + 6) / 2;
    t.true(Math.abs(avg4d6 - exp) < 1);
});

test('Function#id', t => {
    t.is(Function.id('a'), 'a');
});

test('Function#noop', t => {
    t.is(Function.noop('woo'))
});
