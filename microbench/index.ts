import { run, bench } from 'mitata';

const list = ['Hello world', 'Hi', 'Goodbye world'];
const match = [Math.random(), Math.random(), Math.random()];

bench('If else', () => {
    const m = new Array(3);
    for (const item of list) {
        if (item === 'Hello world') m[0] = match[0];
        if (item === 'Hi') m[1] = match[1];
        m[2] = match[2];
    }
});

bench('Ternary', () => {
    const m = new Array(3);
    for (const item of list) {
        item === 'Hello world' ? m[0] = match[0] : (
            item === 'Hi' ? m[1] = match[1] : m[2] = match[2]
        );
    }
});

bench('Switch', () => {
    const m = new Array(3);
    for (const item of list) {
        switch (item) {
            case 'Hello world': m[0] = match[0];
            case 'Hi': m[1] = match[1];
            default: m[2] = match[2];
        }
    }
});

// Try to get the JIT to run
await Bun.sleep(20000);

run();
