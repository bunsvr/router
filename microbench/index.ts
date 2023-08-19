import { run, bench, group } from 'mitata';

const str = 'abcdefgh';

// Deoptimize bench function
bench('noop', () => { });
bench('noop', () => { });
bench('noop', () => { });
bench('noop', () => { });
bench('noop', () => { });
bench('noop', () => { });

group('Substring compare', () => {
    bench('indexOf', () => {
        str.indexOf('def') === 3;
    });

    bench('Substring', () => {
        str.substring(3, 6) === 'def'
    })
});

// @ts-ignore Try to get the JIT to run
await Bun.sleep(7000);

run();
