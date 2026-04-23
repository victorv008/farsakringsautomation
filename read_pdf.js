const fs = require('fs');

// Simple PDF text extractor - looks for text streams in raw PDF bytes
const buf = fs.readFileSync('Oversiktsdesign/Översiktsdesign.pdf', 'latin1');

// Extract text between BT and ET markers (PDF text objects)
const textMatches = buf.match(/BT[\s\S]*?ET/g) || [];
const texts = [];

textMatches.forEach(block => {
  const parts = block.match(/\(([^)]+)\)\s*Tj|<([0-9A-Fa-f]+)>\s*Tj/g) || [];
  parts.forEach(p => {
    const m = p.match(/\(([^)]+)\)/);
    if (m) texts.push(m[1]);
  });
});

console.log(texts.join('\n'));
