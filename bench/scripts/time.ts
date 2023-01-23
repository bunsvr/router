import { appendFile } from "fs/promises";

const date = new Date();

// Destination file
const desFile = "./bench/results.md";

// Format date
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

// Month map
const months = ["January", "Febuary", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

await appendFile(desFile,
    "\nTested at: " +
    formatMH(date.getHours()) + ":" + formatMH(date.getMinutes()) + ", "
    + months[date.getMonth()] + " " + formatDate(date.getDate()) +
    ", " + date.getFullYear() + "\n\n"
);