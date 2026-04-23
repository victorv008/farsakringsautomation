const { PDFParse } = require('pdf-parse');
const fs = require('fs');

const buf = fs.readFileSync('Oversiktsdesign/Översiktsdesign.pdf');
const parser = new PDFParse();

parser.parse(buf).then(data => {
  const text = data.pages.map(p => p.content.map(c => c.text).join(' ')).join('\n\n--- PAGE ---\n\n');
  console.log(text);
}).catch(err => {
  console.error('Error:', err.message);
  // Try alternate approach
  parser.parse(buf).then(d => console.log(JSON.stringify(Object.keys(d)))).catch(e => console.error(e));
});
