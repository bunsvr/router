import { appendFile } from "fs/promises";
import Bun from "bun";
import { readdirSync } from "fs";
import data from "./config.json";

// Destination file
const desFile = "./bench/results.md";
await Bun.write(desFile, `Bun: ${Bun.version}\n`);

// Root directory of the benchmark
const rootDir = import.meta.dir;

// Benchmark results
const results: number[] = [];

// Framework and test URLs
const frameworks = readdirSync(`${rootDir}/src`);
const urls = data.tests.map(v => {
    const arr = [v.path, v.method];
    if (v.body)
        arr.push(JSON.stringify(v.body));

    return arr;
});

// Run scripts
{
    for (const script of data.scripts)
        Bun.spawnSync([script.type, `${rootDir}/scripts/${script.file}`]);
}

// Run benchmark
{
    // Format stuff
    const catchNumber = /Reqs\/sec\s+(\d+[.|,]\d+)/m;
    const getReqSec = (v?: Buffer) => {
        if (!v)
            return -1;

        const num = catchNumber.exec(v.toString());

        if (!num?.[1])
            return -1;

        return Number(num[1]);
    }

    // Default arguments parsing
    const parseDefaultArgs = () => {
        const cmds = data.command;
        const args: string[] = [];

        if (cmds.fasthttp) 
            args.push("--fasthttp");
        if (cmds.connections)
            args.push("-c", String(cmds.connections));
        if (cmds.duration)
            args.push("-d", cmds.duration + "s");

        return args;
    }
    const defaultArgs = parseDefaultArgs();

     // Run commands
    const commands = urls.map(v => {
        const arr = ["bombardier", ...defaultArgs, "http://localhost:3000" + v[0], "-m", v[1]];
        if (v[2])
            arr.push("-b", v[2]);

        return arr;
    });

    const run = () => {
        for (const command of commands) {
            const res = getReqSec(Bun.spawnSync(command as [string, ...string[]]).stdout);

            results.push(res);
            console.log(`\`${command.join(" ")}\`:`, res);
        }
    }

    // Wait for server to boot up
    const sleep = async () =>
        new Promise(res => setTimeout(res, 2000));

    for (const framework of frameworks) {
        Bun.gc(true);
        const desDir = `${rootDir}/src/${framework}`;

        // Boot up
        const server = Bun.spawn(["bun", `${desDir}/index.ts`], { cwd: desDir });
        console.log("Booting", framework + "...");
        await sleep();

        // Benchmark
        console.log("Benchmarking...");
        run();

        // Clean up
        server.kill();
    }
}

// Sort results
{
    let str = "";
    const categories = urls.map(v => `### ${v[1]} \`${v[0]}\``);

    for (let i = 0; i < categories.length; ++i) {
        str += categories[i] + ":\n" + frameworks
            // { name, result }
            .map((v, index) => ({
                name: v,
                res: results[i + index * urls.length]
            }))
            // Sort by result
            .sort((a, b) => b.res - a.res)
            // - name: result
            .map(v => "- " + v.name + ": " + v.res + "\n")
            .join("");
    }

    await appendFile(desFile, str);
}