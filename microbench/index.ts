import { run, bench } from 'mitata';
const a = !!952;
bench('Test 1', () => {
    return a ? 0 : 1;    
});

bench('Test 2', () => {
    if (a) return 0;
    else return 1;
});

run();
