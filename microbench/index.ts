import { run, bench } from 'mitata';
const smallStr: string = 'a';
bench('Test 1', () => {
    switch (smallStr) {
        case 'b': {}
        case 'c': {}
    }  
    return smallStr;
});

bench('Test 2', () => {
    switch (smallStr) {
        case 'b': {}
        case 'c': {}
        default: break
    } 
    return smallStr;
});

run();
