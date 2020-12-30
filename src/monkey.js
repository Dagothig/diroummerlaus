/* istanbul ignore next */
function monkey(obj, fn) {
    obj[fn.name] && console.warn('Overriding existing function!');
    obj[fn.name] = fn;
}

global.$ = Promise;
global.areq = path => require(__dirname + '/' + path);

monkey(Function, function id(x) {
    return x;
});

monkey(Function, function noop() { });

monkey(Array.prototype, function remove(e) {
    const i = this.indexOf(e);
    if (i === -1)
        return false;
    this.splice(i, 1);
    return true;
});

monkey(Array.prototype, function ni(i = 0) {
    return this[this.length - 1 - i];
});

monkey(Array.prototype, function take(n = 1) {
    const taken = this.slice(Math.max(this.length - n, 0));
    this.length = this.length - taken.length;
    return taken;
});

monkey(Array.prototype, function symbols(fn = Function.id) {
    return this.reduce((obj, entry) => {
        const name = fn(entry);
        obj[name] = Symbol(name);
        return obj;
    }, {});
});

monkey(Array.prototype, function findIndexFrom(start, filter, direction = 1) {
    start = (start + this.length) % this.length
    for (let i = start; i < this.length; i += direction)
        if (filter(this[i], i))
            return i;
    for (let i = 0; i < start; i += direction)
        if (filter(this[i], i))
            return i;
    return -1;
});

monkey(Array.prototype, function findFrom(start, filter, direction) {
    return this[this.findIndexFrom(start, filter, direction)];
});

monkey(Array.prototype, function findEntry(fn = Function.id) {
    const index = this.findIndex(fn);
    return [index, this[index]];
});

monkey(Array.prototype, function sum(fn = Function.id) {
    return this.reduce((n, m) => n + fn(m), 0);
});

monkey(Array.prototype, function prod(fn = Function.id) {
    return this.reduce((n, m) => n * fn(m), 1);
});

monkey(Array, function gen(n, fn = Function.id){
    return new Array(n).fill().map((_, i) => fn(i));
});

monkey(Array.prototype, function except(...others) {
    return this.filter(x => !others.includes(x));
});

monkey(Array.prototype, function $find(fn) {
    return $.race([
        ...this.map(promise => new $(async (resolve, reject) => {
            try {
                const result = await promise;
                fn(result) && resolve(result);
            } catch (err) {
                reject(err);
            }
        })),
        $.all(this).then(Function.noop)
    ]);
});

monkey(Array.prototype, function toObject() {
    return Object.fromEntries(this);
});

monkey(Math, function clip(x, min, max) {
    return Math.min(max, Math.max(min, x));
});

monkey(Math, function randint(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
});

monkey(Math, function dice(amount, sides) {
    return new Array(amount).fill().map(() => Math.randint(1, sides)).reduce((n, m) => n + m);
});

monkey(Math, function shuffle(arr) {
    for (var i = arr.length; i--;) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = arr[i];
        arr[i] = arr[j];
        arr[j] = temp;
    }
    return arr;
});

monkey(Object, function allKeys(obj) {
    return [...Object.keys(obj), ...Object.getOwnPropertySymbols((obj))];
});

monkey(Object, function allValues(obj) {
    return Object.allKeys(obj).map(key => obj[key]);
});

monkey($, function controller() {
    let abort;
    const abortPromise = new $(res => abort = res);
    return { onAbort: abortPromise.then.bind(abortPromise), abort, $abort: abortPromise };
});

monkey(String.prototype, function pascal() {
    return this[0].toUpperCase() + this.slice(1);
})
