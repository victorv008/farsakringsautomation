/**
 * GOOGLE SHEETS → INSURANCE CARDS LOADER
 * ─────────────────────────────────────────────────────────────
 * Fetches published CSV from Google Sheets, parses it,
 * and renders insurance comparison cards into #results-wrapper.
 *
 * SETUP:
 * 1. Replace SHEET_CSV_URL with your published Google Sheets CSV URL
 * 2. Include this script at the bottom of resultat.html
 * 3. Make sure #results-wrapper exists in the HTML
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONFIGURATION — Replace this URL with your own published CSV
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const SHEET_CSV_URL = 'YOUR_GOOGLE_SHEETS_CSV_URL_HERE';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CSV PARSER — handles quoted fields, commas inside quotes, etc.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function parseCSV(text) {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = parseCSVLine(lines[0]);
    return lines.slice(1).map(line => {
        const values = parseCSVLine(line);
        const obj = {};
        headers.forEach((h, i) => {
            obj[h.trim().toLowerCase()] = (values[i] || '').trim();
        });
        return obj;
    });
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    result.push(current);
    return result;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CARD RENDERER — creates the HTML for each insurance card
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function renderActiveCard(item, index) {
    const monthlyPrice = Math.round(parseInt(item.pris_ar) / 12);
    const badges = (item.badges || '').split(',').map(b => b.trim()).filter(Boolean);
    const hasNedtrappning = item.nedtrappning && item.nedtrappning.trim();

    // Determine badge types
    const badgeHTML = badges.map(badge => {
        return `<span class="tg tg-g"><span class="material-symbols-outlined text-[14px]">check</span>${badge}</span>`;
    }).join('\n');

    // Warning badge for nedtrappning
    const warnHTML = hasNedtrappning
        ? `<span class="tg tg-r"><span class="material-symbols-outlined text-[14px]">warning</span>Nedtrappning från ${item.nedtrappning} år</span>`
        : '';

    // "Best in test" ribbon for first card
    const ribbonHTML = index === 0
        ? `<div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#0D7377] to-[#14a0a5] rounded-t-[24px]"></div>
           <span class="absolute top-4 right-6 bg-[#e8a838] text-white text-xs font-bold px-3 py-1 rounded-full">⭐ Bäst i test</span>`
        : '';

    return `
    <article class="result-card bg-white rounded-[24px] p-8 shadow-[0_12px_32px_rgba(26,28,28,0.06)] flex flex-col gap-6 relative overflow-hidden border border-[#00595c]/5 hover:shadow-[0_20px_48px_rgba(13,115,119,0.12)] transition-shadow mb-6">
        ${ribbonHTML}
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 pb-6">
            <div class="flex items-center gap-4">
                <div class="w-16 h-16 rounded-xl bg-[#f2f9f9] flex items-center justify-center border border-[#00595c]/10">
                    <span class="font-headline font-bold text-[#00595c] text-sm text-center leading-tight px-1">${item.bolag}</span>
                </div>
                <div>
                    <h3 class="font-headline font-bold text-xl text-[#00595c]">${item.produkt}</h3>
                    <p class="text-sm text-[#00595c]/60">${item.bolag} · ${item.halso_dekl === 'Nej' ? 'Ingen hälsodeklaration' : 'Hälsodeklaration krävs'}</p>
                </div>
            </div>
            <div class="text-left sm:text-right shrink-0">
                <div class="font-headline text-3xl font-extrabold text-[#00595c]">${parseInt(item.pris_ar).toLocaleString('sv-SE')} kr<span class="text-lg font-medium text-[#00595c]/50">/år</span></div>
                <p class="text-xs text-[#00595c]/50 mt-1">≈ ${monthlyPrice} kr/mån</p>
            </div>
        </div>
        <div class="flex flex-wrap gap-3">
            <div class="bg-[#f2f9f9] px-3 py-2 rounded-lg flex items-center gap-2 border border-[#00595c]/5 text-sm font-medium text-[#00595c]">
                <span class="material-symbols-outlined text-sm">calendar_today</span>${item.alder_min}–${item.alder_max} år
            </div>
            <div class="bg-[#f2f9f9] px-3 py-2 rounded-lg flex items-center gap-2 border border-[#00595c]/5 text-sm font-medium text-[#00595c]">
                <span class="material-symbols-outlined text-sm">hourglass_empty</span>Gäller till ${item.galler_till} år
            </div>
            <div class="bg-[#f2f9f9] px-3 py-2 rounded-lg flex items-center gap-2 border border-[#00595c]/5 text-sm font-medium text-[#00595c]">
                <span class="material-symbols-outlined text-sm">payments</span>Max ${item.maxbelopp_mkr} Mkr
            </div>
        </div>
        <div class="flex flex-wrap gap-2">
            ${badgeHTML}
            ${warnHTML}
        </div>
        <div class="pt-4 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
            <a class="text-sm font-semibold text-[#00595c] underline underline-offset-4 hover:text-[#e8a838] transition-colors" href="#">Läs fullständiga villkor</a>
            <button class="bg-[#e8a838] text-white font-bold px-8 py-3 rounded-xl hover:bg-[#f0c273] transition-all flex items-center gap-2">
                Gå till bolaget <span class="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
        </div>
    </article>`;
}

function renderExcludedCard(item) {
    return `
    <article class="result-card excl bg-white/60 rounded-[24px] p-8 flex flex-col gap-4 border-2 border-dashed border-gray-200 mb-4">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div class="flex items-center gap-4">
                <div class="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center border border-gray-200 opacity-50">
                    <span class="font-headline font-bold text-gray-500 text-sm text-center">${item.bolag}</span>
                </div>
                <div>
                    <h3 class="font-headline font-bold text-xl text-gray-400 line-through">${item.produkt}</h3>
                    <p class="text-sm text-gray-400">${item.bolag}</p>
                </div>
            </div>
            <div class="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                <span class="material-symbols-outlined text-red-400">block</span>
                <div>
                    <p class="text-xs font-bold text-red-500 uppercase tracking-wide">Exkluderad</p>
                    <p class="text-sm text-gray-600">${item.exkluderad_orsak || 'Matchar inte kriterier'}</p>
                </div>
            </div>
        </div>
    </article>`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN LOADER — fetch, parse, render
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function loadInsuranceData() {
    const wrapper = document.getElementById('results-wrapper');
    if (!wrapper) return;

    // Show loading state
    wrapper.innerHTML = `
        <div class="text-center py-16">
            <span class="material-symbols-outlined text-4xl text-[#00595c] animate-spin">progress_activity</span>
            <p class="text-[#00595c]/60 mt-4 font-headline">Hämtar försäkringar...</p>
        </div>`;

    try {
        // Check if URL is configured
        if (SHEET_CSV_URL === 'YOUR_GOOGLE_SHEETS_CSV_URL_HERE') {
            console.warn('⚠️ sheets-loader.js: No Google Sheets URL configured. Using static cards.');
            return; // Fall back to static HTML cards
        }

        const response = await fetch(SHEET_CSV_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const csvText = await response.text();
        const data = parseCSV(csvText);

        if (data.length === 0) {
            wrapper.innerHTML = '<p class="text-[#00595c]/60 py-8 text-center">Inga försäkringar hittades.</p>';
            return;
        }

        // Split into active and excluded
        const active = data.filter(d => (d.status || 'aktiv').toLowerCase() === 'aktiv');
        const excluded = data.filter(d => (d.status || '').toLowerCase() === 'exkluderad');

        // Sort active by price (lowest first)
        active.sort((a, b) => parseInt(a.pris_ar || 0) - parseInt(b.pris_ar || 0));

        // Build HTML
        let html = `
            <div class="flex items-end justify-between mb-6">
                <h1 class="font-headline text-3xl font-extrabold text-[#00595c] tracking-tight">
                    ${active.length} försäkringar matchar dina uppgifter
                </h1>
            </div>`;

        // Active cards
        active.forEach((item, i) => {
            html += renderActiveCard(item, i);
        });

        // Excluded section
        if (excluded.length > 0) {
            html += `
                <h2 class="font-headline text-lg font-bold text-[#00595c]/50 mb-1 mt-8">
                    🚫 ${excluded.length} försäkringar som inte matchar fullt ut
                </h2>
                <p class="text-sm text-[#00595c]/40 mb-5">Dessa matchade inte dina uppgifter.</p>`;

            excluded.forEach(item => {
                html += renderExcludedCard(item);
            });
        }

        // Stagger animation script
        html += `
            <script>
                document.querySelectorAll('.result-card').forEach((c, i) => {
                    setTimeout(() => c.classList.add('visible'), 100 + i * 110);
                });
            </script>`;

        wrapper.innerHTML = html;

    } catch (error) {
        console.error('❌ sheets-loader.js: Failed to load data:', error);
        wrapper.innerHTML = `
            <div class="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
                <span class="material-symbols-outlined text-red-400 text-3xl">error</span>
                <p class="text-red-600 font-headline font-bold mt-3">Kunde inte hämta försäkringsdata</p>
                <p class="text-red-400 text-sm mt-2">${error.message}</p>
            </div>`;
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INIT — run when DOM is ready
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
document.addEventListener('DOMContentLoaded', loadInsuranceData);
