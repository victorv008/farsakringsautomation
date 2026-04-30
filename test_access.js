const fs = require('fs');
try {
    const files = fs.readdirSync('../ElvioNode');
    console.log(files);
} catch (err) {
    console.error(err);
}
