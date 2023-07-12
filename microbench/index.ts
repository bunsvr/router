import { run, bench } from 'mitata';

function v(a = 0, b = 1) { return a + b };

bench('No default', () => {
    v(0, 1); v(0, 1); v(0, 1); v(0, 1);
});
bench('With default', () => {
    v(); v(); v(); v();
});

run();
