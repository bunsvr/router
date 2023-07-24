/// <reference types='bun-types' />
import { existsSync, rmSync } from 'fs';

Bun.build({
    format: 'esm',
    target: 'bun',
    outdir: '.',
    minify: true,
    entrypoints: ['./src/index.ts']
});

// Generating types
const dir = './types'; 
if (existsSync(dir)) rmSync(dir, { recursive: true });

// Build type declarations
const buildTypes = 'bun x tsc --outdir ' + dir;
Bun.spawnSync(buildTypes.split(' '), { stdout: 'inherit' });
