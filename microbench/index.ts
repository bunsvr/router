import { run, bench } from 'mitata';
import { Radx } from '..';

const noOptimize = new Radx<number>, optimized = new Radx<number>;
noOptimize.add('GET', '/id/:id', 0);
noOptimize.composeFind();

optimized.normalUsage = false;
optimized.add('GET', '/id/:id', 0);
optimized.composeFind();

const path1 = '/id/90', path2 = path1.substring(1);

bench('No compose', () => {
    noOptimize.find('GET', path1);
    noOptimize.find('GET', path1);
    noOptimize.find('GET', path1);
    noOptimize.find('GET', path1);
    noOptimize.find('GET', path1);
});
bench('With compose', () => {
    optimized.find('GET', path2);
    optimized.find('GET', path2);
    optimized.find('GET', path2);
    optimized.find('GET', path2);
    optimized.find('GET', path2);
});

// Try to get the JIT to run
await Bun.sleep(20000);

run();
