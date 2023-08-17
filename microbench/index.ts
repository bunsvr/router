import { run, bench, group } from 'mitata';

// @ts-ignore Try to get the JIT to run
await Bun.sleep(7000);

run();
