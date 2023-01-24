import { appendFile } from "fs/promises";
import Bun from "bun";
import { readdirSync } from "fs";

// Destination file
const desFile = "./bench/results.md";
const rootDir = import.meta.dir;
await Bun.write(desFile, `Bun: ${Bun.version}\n`);

// Scripts
{
    const scripts = [["bun", "time.ts"], ["node", "os.cjs"]];
    for (const script of scripts)
        Bun.spawnSync([script[0], `${rootDir}/scripts/${script[1]}`]);
}

// Benchmark results
const results: number[] = [];

// Framework and test URLs
const frameworks = readdirSync(`${rootDir}/src`);
const urls = [["/", "GET"], ["/id/90", "GET"], ["/a/b", "GET"], ["/json", "POST", `{"hello":"world"}`]];

// Run benchmark
{
    // Format stuff
    const catchNumber = /Reqs\/sec\s+(\d+[.|,]\d+)/m;
    const getReqSec = (v?: Buffer) => {
        if (!v)
            return -1;

        const str = v.toString();
        const num = catchNumber.exec(str);

        if (!num?.[1])
            return -1;

        return Number(num[1]);
    }

    // Run commands
    const defaultArgs = ["bombardier", "--fasthttp", "-c", "1000", "-d", "20s"];
    const commands = urls.map(v => {
        const arr = [...defaultArgs, "http://localhost:3000" + v[0], "-m", v[1]];
        if (v[2])
            arr.push("-b", v[2]);

        return arr;
    });

    const run = () => {
        for (const command of commands) {
            const { stdout } = Bun.spawnSync(command as [string, ...string[]]);
            results.push(getReqSec(stdout));
        }
    }

    // Wait for server to boot up
    const sleep = async () =>
        new Promise(res => setTimeout(res, 2000));

    for (const framework of frameworks) {
        // Boot up
        const server = Bun.spawn(["bun", `${rootDir}/src/${framework}/index.ts`]);
        console.log("Booting", framework + "...");
        await sleep();

        // Benchmark
        console.log("Benchmarking...");
        run();

        // Clean up
        server.kill();
        Bun.gc(true);
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