import { run, bench } from 'mitata';
import { Radx } from '..';

const noComposeFind = new Radx<number>, composedFind = new Radx<number>;
noComposeFind.add('GET', '/id/:id', 0);
noComposeFind.add('POST', '/:id/dashboard', 1);

composedFind.normalUsage = false;
composedFind.add('GET', '/id/:id', 0);
composedFind.composeFind();

bench('No compose', () => {
    noComposeFind.find('GET', '/id/90');
    noComposeFind.find('GET', '/id/90');
});
bench('With compose', () => {
    composedFind.find('GET', 'id/90');
    composedFind.find('GET', 'id/90');
});

// Try to get the JIT to run
await Bun.sleep(20000);

run();
