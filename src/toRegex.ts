import { parse } from "path-to-regexp";

function escapeString(str: string) {
    return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}

export default function toRegex(path: string) {
    const arr = parse(path);
    let reg = "", unnamedCount = -1;

    for (const pattern of arr) {
        if (typeof pattern === "string") {
            reg += escapeString(pattern);
            continue;
        }

        const name = `?<${pattern.name || `_${++unnamedCount || ""}`}>`;
        pattern.prefix = escapeString(pattern.prefix);

        if (pattern.modifier === "+" || pattern.modifier === "*") {
            const mod = pattern.modifier === "*" ? "?" : "";
            reg += `(?:${pattern.prefix}((?:${name}${pattern.pattern})(?:${pattern.suffix}${pattern.prefix}(?:${pattern.pattern}))*)${pattern.suffix})${mod}`;
        } else 
            reg += `(?:${pattern.prefix}(${name}${pattern.pattern})${pattern.suffix})${pattern.modifier}`;
    }

    return new RegExp(`^(${reg})$`);
}