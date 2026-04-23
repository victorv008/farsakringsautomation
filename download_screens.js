const https = require('https');
const fs = require('fs');
const path = require('path');

const outDir = process.argv[2];

const downloads = [
  { name: 'steg1.png', url: 'https://lh3.googleusercontent.com/aida/ADBb0uhpHyo3zktgvVyOhlMSsVabjgpd26RUsEEyJAt8hg4IdW6evzlH9_zcFdLrRIklvIvVOh46BgiCxru1bto5pI0Vv7pY4VefaLGaa31st-miGjZ8P_LGs0L7RHh9roF6F6UG-vwFrJQbmp7-yCqMUys8Zs6fGlhDmF-9PIEQ1_DP4io8QVGEeTbnoyzZTCMyKgxPrDtKLZ9ON03GIPdVumNIS5HPbEaOFM35OAmdAgQYCLIMEz5QBHhGMMM' },
  { name: 'steg2.png', url: 'https://lh3.googleusercontent.com/aida/ADBb0ujsgGv7208gjwqiW_LQrFyE8XPH4XWydAfYABL44OT8tNy-AUxUPx5ni9kAgOeS2Txx6Drzr1sPWdarpNV74iEViRYHlP1Hi2gjOIH8bi4uBck3rsT1WasnX1AUqyniFzcNpCfnNpPab9F9CHdrYYLjqLuOq75Jw7DVR3bvZnMCTNbshEkJGPEhbsdfgghtHoS8YUPKDGJkFh6W_SGhgjh8sdYsg3tBdDf5kXOlA9wiON3UXzVxc7jOnnM' },
  { name: 'steg3.png', url: 'https://lh3.googleusercontent.com/aida/ADBb0uiMywPdgAerhDK6T3-f8mG0hjW2i8TOdfosH-nAHq-CHIAcjlFJwRJmad8jC4m0Y4L9-hpXwo7YcocmqsauoP3yNSXWiXj48XBzQgYV3e4kwHJpMAXDuaa7MiYvduVfsJ2bp729En-SXRN7cGil6I8SJ6L1UFLclcowZmlv0QGrMfTsdPYOoIksaDlsrQlxMnsF1MSDyleuNpEUFASEnzdK6MxEicQRqpi9joMhu2nMTq82r7BL-mKPjWs' },
  { name: 'om_oss.png', url: 'https://lh3.googleusercontent.com/aida/ADBb0ugMJgqSAGePeiF-0a9TUYmLMTYeYlVeA4KzE1_5-hbGGCkjkx8jh4FAh6TkELTmtRIKq50LxM6cWA0fo73uB5ScVYoZgoXr41EJh6JxoSDtLpfUc6cB0xa6_mR_aFqwBzsPOIdzBNUXxjYpPVwav19aS3DhNsyp-Z1UuGEhS9-4B82ab5fyhKEh0tJDwfils5PAYxGOJbttdyK4fA3sOb6_BYaHoFiFCdkAC7QRI_-eh35otehqJVe3vQ' }
];

downloads.forEach(d => {
  const dest = path.join(outDir, d.name);
  const file = fs.createWriteStream(dest);
  https.get(d.url, function(response) {
    response.pipe(file);
    file.on('finish', function() {
      file.close();  // close() is async, call cb after close completes.
    });
  }).on('error', function(err) { // Handle errors
    fs.unlink(dest, () => {});
    console.error(err.message);
  });
});
