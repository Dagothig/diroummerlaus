module.exports = Object.bindFunctions(class AsyncQueue {
    constructor() {
        this.backing = [];
        this.awaiting = [];
    }

    enqueue(...values) {
        for (let value of values) {
            if (this.awaiting.length) {
                this.awaiting.shift()(value);
            } else {
                this.backing.push(value);
            }
        }
    }

    async $dequeue(n = 1) {
        const taken = this.backing;
        this.backing = this.backing.slice(n);
        taken.length = Math.min(taken.length, n);
        const remaining = [];
        this.awaiting.push(...Array.gen(n - taken.length, () => {
            let resolve;
            remaining.push(new Promise(res => resolve = res));
            return resolve;
        }));
        taken.push(...await Promise.all(remaining));
        return taken;
    }

    async $find(fn) {
        while(true) {
            const [next] = await this.$dequeue();
            if (fn(next)) {
                return next;
            }
        }
    }
});
