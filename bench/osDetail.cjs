const list = ["B", "KB", "MB", "GB", "TB"];
const formatByte = bytes => {
    let i = 0;
    while (bytes >= 1000) {
        bytes = Math.round(bytes / 10) / 100;
        ++i;
    }
    
    return bytes + list[i];
}

const { appendFileSync, existsSync, writeFileSync } = require("fs");
const os = require("os");

const desFile = "./bench/results.md";

if (!existsSync(desFile))
    appendFileSync(desFile, "");

// Get OS details
let str = "";
str += "## OS Details\n";

const cpus = os.cpus();
str += "- CPU: " + cpus[0].model + "\n";
str += "- Cores: " + cpus.length + "\n";
str += "- Type: " + os.type() + "\n";
str += "- Total RAM: " + formatByte(os.totalmem()) + "\n";
str += "- Free RAM: " + formatByte(os.freemem()) + "\n";
str += "\n## Results\n";

writeFileSync(desFile, str);