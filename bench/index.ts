import Bun from "bun";

// Format stuff
const catchNumber = /Reqs\/sec\s+(\d+[.|,]\d+)/m;
const getReqSec = (v?: Buffer) => {
    if (!v)
        return -1;

    const str = v.toString();
    const num = catchNumber.exec(str);
    console.log(str);

    if (!num?.[1])
        return -1;

    return Number(num[1]);
}

// Run commands
const defaultArgs = ["bombardier", "--fasthttp", "-c", "500", "-d", "10s"];
const commands = ["/", "/90", "/a/b"]
    .map(v => [...defaultArgs, "http://localhost:3000" + v]);

const desFile = "./bench/results.txt";
const results: number[] = [];

const run = async (server: Bun.Subprocess<Bun.OptionsToSubprocessIO<Bun.SpawnOptions.OptionsObject>>) => {
    for (const command of commands) {
        const { stdout } = Bun.spawnSync(command as [string, ...string[]]); 
        results.push(getReqSec(stdout));
    }

    server.kill();
}

// Wait for server to boot up
const sleep = async () => 
    new Promise(res => setTimeout(res, 2000));

// Start running
const files = ["bunsvr", "elysia"].map(v => `./bench/${v}.ts`);

for (const file of files) {
    const server = Bun.spawn(["bun", file]);
    await sleep();
    await run(server);
}

// Results will be all here
let str = "", cnt = 0;
for (const cat of ["GET '/'", "GET '/90'", "GET '/a/b'"]) {
    str += cat + ":\n";
    const arr = [{
        name: "BunSVR", 
        res: results[cnt]
    }, {
        name: "Elysia",
        res: results[cnt + 3]
    }].sort((a, b) => b.res - a.res);

    str += arr.map(v => "- " + v.name + ": " + v.res + "\n").join("");

    ++cnt;
}

// Get time
const date = new Date();
const months = ["January", "Febuary", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

str += "\nTested at: " + 
    date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds() + " "
    + days[date.getDay()] + " " + months[date.getMonth()] + " " + date.getDate() + " " + date.getFullYear();
console.log(str);