const xlsx = require('xlsx');
const path = require('path');

const filePath = 'livforsakring_datainsamling_v2.xlsx';
const workbook = xlsx.readFile(filePath);

const dataJustInCase = {
    Grunddata: {
        'Webbsida (produktsida)': 'https://justincase.se/',
        'Villkors-PDF (länk)': 'https://justincase.se/villkor/',
        'Min belopp (kr)': 1000000,
        'Max belopp (kr)': 6000000,
        'Beloppssteg (kr)': 'Valfritt',
        'Min ålder': 16,
        'Max teckningsålder': 59,
        'Slutålder': 65,
        'Nedtrappning (Ja/Nej)': 'Nej',
        'Nedtrappning startar vid ålder': '-',
        'Nedtrappning % per år': '-',
        'Hälsodeklaration (Ja/Nej/Läkarintyg)': 'Nej (för Grundskyddet)',
        'Läkarintyg från belopp (kr)': '-',
        'Karenstid självmord (mån)': 12,
        'Karenstid övriga (dagar)': 0,
        'Undantag: Krig': 'Ja',
        'Undantag: Extremsport': 'Ja',
        'Undantag: Utlandsvistelse': 'Ja (begränsning vid längre vistelse)',
        'Undantag: Övriga': 'Droger, alkohol',
        'Bindningstid': 'Ingen',
        'Uppsägningstid': 'Ingen (skriftlig krävs)',
        'Fast/Rörlig premie': 'Individuell (kan variera)',
        'Värdesäkring (Ja/Nej)': 'Nej',
        'Förmånstagarordning (standard)': 'Make/sambo, barn, arvingar',
        'Barnlivförsäkring ingår (Ja/Nej)': 'Nej',
        'Senast verifierad': new Date().toISOString().split('T')[0],
        'Anteckningar': 'Baserat på användarens information'
    },
    Villkorsanalys: {
        'Gäller dygnet runt': 'Ja',
        'Gäller i Norden': 'Ja',
        'Gäller globalt (max tid)': 'Ja (begränsning vid längre vistelse)',
        'Självmordskarens (mån)': 12,
        'Krig/terrorundantag': 'Ja',
        'Extremsport specificerat': 'Ja',
        'Drogundantag': 'Ja',
        'Alkoholundantag': 'Ja',
        'Kronisk sjukdom påverkar': 'Ja (påverkar eventuellt)',
        'Psykisk ohälsa påverkar': 'Ja (påverkar eventuellt)',
        'Rökare prispåslag': 'Ja (baserat på individuell premie)',
        'BMI-krav': 'Oklart (individuell bedömning)',
        'Förmånstagare ändras enkelt': 'Ja',
        'Digital teckning möjlig': 'Ja',
        'Sammanfattande kommentar': 'Specialaktör för livförsäkring. Enkel teckning av grundskydd utan hälsointyg.'
    }
};

workbook.SheetNames.forEach(sheetName => {
    if (dataJustInCase[sheetName]) {
        const sheet = workbook.Sheets[sheetName];
        let data = xlsx.utils.sheet_to_json(sheet);
        
        // Find JustInCase row
        let rowIndex = data.findIndex(row => row['Bolag'] === 'JustInCase');
        
        if (rowIndex === -1) {
            // Add new row if not found
            data.push({ Bolag: 'JustInCase', ...dataJustInCase[sheetName] });
        } else {
            // Update existing row
            data[rowIndex] = { ...data[rowIndex], ...dataJustInCase[sheetName] };
        }
        
        const newSheet = xlsx.utils.json_to_sheet(data);
        workbook.Sheets[sheetName] = newSheet;
    }
});

xlsx.writeFile(workbook, filePath);
console.log('Successfully updated livforsakring_datainsamling_v2.xlsx');
