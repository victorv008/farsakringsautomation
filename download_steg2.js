const fs = require('fs');
const https = require('https');

const data = JSON.parse(fs.readFileSync('C:/Users/Victor/.gemini/antigravity/brain/06834561-f4be-4178-8021-db8972d5364e/.system_generated/steps/196/output.txt', 'utf8'));

// Only download the missing Steg 2 grid
const id = '23ca9626e2e5414ead82e4e04746f3df'; // Steg 2 - Välj din livssituation
const screen = data.screens.find(s => s.name.endsWith(id));

if (screen && screen.htmlCode && screen.htmlCode.downloadUrl) {
    const target = 'C:/Users/Victor/Farsäkringsautomation/livsforsakringar-mvp/livssituation.html';
    const file = fs.createWriteStream(target);
    https.get(screen.htmlCode.downloadUrl, response => {
        response.pipe(file);
        file.on('finish', () => {
            file.close();
            console.log('Downloaded Steg 2');
        });
    }).on('error', err => {
        console.error('Error:', err);
    });
} else {
    console.log("Could not find HTML for Steg 2.");
}
