const fs = require('fs');
const https = require('https');

const data = JSON.parse(fs.readFileSync('C:/Users/Victor/.gemini/antigravity/brain/06834561-f4be-4178-8021-db8972d5364e/.system_generated/steps/196/output.txt', 'utf8'));

const targetScreens = {
    'dbd4b405c7b34dc18c4c4cf7dc2b0cf2': 'C:/Users/Victor/Farsäkringsautomation/livsforsakringar-mvp/index.html',
    'd0b4028f18bf476a8a1532f55d78f17d': 'C:/Users/Victor/Farsäkringsautomation/livsforsakringar-mvp/livssituation.html',
    '70e1b073060540c783be8d46e86447f3': 'C:/Users/Victor/Farsäkringsautomation/livsforsakringar-mvp/resultat.html',
    '42a3d4b28f5c4984a55f5d34f116d0bc': 'C:/Users/Victor/Farsäkringsautomation/livsforsakringar-mvp/om-oss.html'
};

data.screens.forEach(screen => {
    const id = screen.name.split('/').pop();
    if (targetScreens[id] && screen.htmlCode && screen.htmlCode.downloadUrl) {
        console.log('Downloading HTML for', id, 'to', targetScreens[id]);
        const file = fs.createWriteStream(targetScreens[id]);
        https.get(screen.htmlCode.downloadUrl, response => {
            response.pipe(file);
            file.on('finish', () => file.close());
        }).on('error', err => {
            console.error('Download error:', err);
        });
    }
});
