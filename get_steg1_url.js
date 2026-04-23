const fs = require("fs");
const https = require("https");

const dataRaw = fs.readFileSync("C:\\Users\\Victor\\.gemini\\antigravity\\brain\\06834561-f4be-4178-8021-db8972d5364e\\.system_generated\\steps\\196\\output.txt", "utf-8");
const data = JSON.parse(dataRaw);
const screens = data.screenInstances || data;
const screen = screens.find(s => s.htmlCode && (s.htmlCode.name.includes("fcb6b01ea82b4dcf9bcb6468e52a52b7") || (s.title && s.title.includes("Ålder och Belopp"))));

if (screen) {
    const url = screen.htmlCode.downloadUrl;
    console.log("Downloading from", url);
    https.get(url, (res) => {
        const dest = fs.createWriteStream("C:\\Users\\Victor\\Farsäkringsautomation\\livsforsakringar-mvp\\steg1_original.html");
        res.pipe(dest);
        dest.on("finish", () => {
            console.log("Downloaded steg1_original.html successfully");
            dest.close();
        });
    });
} else {
    console.log("Screen not found in", data.title || "data");
}
