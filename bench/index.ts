import { appendFile } from "fs/promises";
import Bun from "bun";

// Benchmark results
const results: number[] = [];

// Framework and test URLs
const frameworks = ["BunSVR", "Native"];
const urls = [["/", "GET"], ["/id/90", "GET"], ["/a/b", "GET"], ["/json", "POST", `{"hello":"world"}`]];

// OS Details
Bun.spawnSync(["node", "./bench/osDetail.cjs"]);

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
    const defaultArgs = ["bombardier", "--fasthttp", "-c", "500", "-d", "10s"];
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
        const server = Bun.spawn(["bun", `./bench/src/${framework.toLowerCase()}.ts`]);
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



// Format result
{
    // Destination file
    const desFile = "./bench/results.md";

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

    // Get time
    {
        const date = new Date();
        const months = ["January", "Febuary", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const formatDate = (d: number) => {
            const mod = d % 10;
            if (d === 11 || d === 12 || d === 13)
                return d + "th";

            switch (mod) {
                case 1:
                    return d + "st";
                case 2:
                    return d + "nd";
                case 3:
                    return d + "rd";
            }

            return d + "th";
        }

        // Format minutes and hours
        const formatMH = (d: number) => (d < 10 ? "0" : "") + d;

        await appendFile(desFile, 
            "\nTested at: " +
            formatMH(date.getHours()) + ":" + formatMH(date.getMinutes()) + ", "
            + months[date.getMonth()] + " " + formatDate(date.getDate()) + 
            ", " + date.getFullYear() + "\n\n"
        );
    }

    // Bun version
    await appendFile(desFile, "Bun: " + Bun.version);
}