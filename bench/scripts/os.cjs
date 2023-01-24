const list = ["B", "KB", "MB", "GB", "TB"];
const formatByte = bytes => {
    let i = 0;
    while (bytes >= 1000) {
        bytes = Math.round(bytes / 10) / 100;
        ++i;
    }
    return bytes + list[i];
}
const formatOS = str => {
    switch (str) {
        case "Windows_NT":
            return "Windows";
        case "Darwin":
            return "Mac";
        default:
            return "Linux";
    }
}

const { appendFileSync } = require("fs");
const os = require("os");

const desFile = "./bench/results.md";

// Get OS details
let str = "";
str += "## OS Details\n";

const cpus = os.cpus();
str += "- CPU: " + cpus[0].model + "\n";
str += "- Cores: " + cpus.length + "\n";
str += "- OS: " + formatOS(os.type()) + "\n";
str += "- System memory: " + formatByte(os.totalmem()) + "\n";
str += "- Architecture: " + os.arch() + "\n";
str += "\n## Results\n";

appendFileSync(desFile, str);