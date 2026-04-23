document.addEventListener('DOMContentLoaded', () => {
    // 1. Läs in data från sessionStorage
    const age = parseInt(sessionStorage.getItem('ins_age') || '30');
    const amount = parseInt(sessionStorage.getItem('ins_amount') || '2000000');
    const job = sessionStorage.getItem('ins_job') || 'anstalld';
    const scenario = sessionStorage.getItem('ins_scenario') || 'standard';

    // 2. Uppdatera UI i sidebar om elementen finns (Tailwind versionen)
    const contextBanner = document.getElementById('context-banner');
    if (contextBanner) {
        let scenarioName = 'Standard';
        const scenarioNames = {
            'bostadskop': 'Bolån',
            'elitsport': 'Extrem sport',
            'barn': 'Barn',
            'hog_belopp': 'Stort kapitalbehov',
            'aldersgrans': '65+ år',
            'utlands': 'Ska flytta utomlands',
            'standard': 'Standard'
        };
        scenarioName = scenarioNames[scenario] || 'Standard';
        contextBanner.innerHTML = `Baserat på dina val: <strong class="text-on-surface">${age} år, ${(amount / 1000000).toLocaleString('sv-SE')} Mkr, ${scenarioName}</strong>. Vi har hittat matchande försäkringar.`;
    }

    // 3. Hämta datan och rendera
    fetch('data/insurance.json')
        .then(res => res.json())
        .then(data => {
            const wrapper = document.getElementById('results-wrapper');
            if(!wrapper) return; // Not on the results page

            // Sortera: De som inte är eliminerade först, sedan pris
            let processedData = data.map(company => processCompany(company, age, amount, job, scenario));
            
            processedData.sort((a, b) => {
                if(a.eliminated && !b.eliminated) return 1;
                if(!a.eliminated && b.eliminated) return -1;
                const priceA = a.calculatedPrice || 999999;
                const priceB = b.calculatedPrice || 999999;
                return priceA - priceB;
            });

            // Update header count
            const countHeader = document.getElementById('count-header');
            if (countHeader) {
                const numValid = processedData.filter(d => !d.eliminated).length;
                countHeader.textContent = `${numValid} försäkringar matchar dina uppgifter`;
            }

            // Remove existing cards (keep the header)
            Array.from(wrapper.children).forEach(child => {
                if(child.id !== 'count-header') {
                    child.remove();
                }
            });

            // Separate arrays
            const qualified = processedData.filter(d => !d.eliminated);
            const disqualified = processedData.filter(d => d.eliminated);

            // Render Qualified
            qualified.forEach((comp) => {
                wrapper.appendChild(createTailwindCard(comp));
            });

            // Render Disqualified container
            if (disqualified.length > 0) {
                const disqContainer = document.createElement('div');
                disqContainer.className = "mt-16 mb-8 border-t border-surface-variant pt-12";
                disqContainer.innerHTML = `<h2 class="font-headline text-2xl font-bold text-on-surface mb-6 flex items-center gap-3">
                        <span class="material-symbols-outlined text-error">visibility_off</span>
                        ${disqualified.length} försäkringar som inte matchar fullt ut
                    </h2>`;
                
                disqualified.forEach((comp) => {
                    disqContainer.appendChild(createDisqualifiedCard(comp));
                });
                wrapper.appendChild(disqContainer);
            }
        })
        .catch(err => {
            console.error(err);
        });
});

// Tailwind Card creation
function createTailwindCard(comp) {
    const card = document.createElement('article');
    card.className = "bg-surface-container-lowest rounded-[24px] p-8 shadow-[0_12px_32px_rgba(26,28,28,0.06)] flex flex-col gap-6 relative overflow-hidden transition-all hover:shadow-[0_16px_40px_rgba(26,28,28,0.08)] mb-6";
    
    let priceHtml = '';
    if (comp.calculatedPrice) {
        const perMonth = Math.round(comp.calculatedPrice / 12);
        priceHtml = `<div class="font-headline text-3xl font-extrabold text-primary">${comp.calculatedPrice.toLocaleString('sv-SE')} kr<span class="text-lg font-medium text-on-surface-variant">/år</span></div>
                     <p class="text-xs text-on-surface-variant font-medium mt-1">Motsvarar ca ${perMonth} kr/mån</p>`;
    } else {
        priceHtml = `<div class="font-headline text-2xl font-extrabold text-primary">Pris okänt</div>`;
    }

    let tagsHtml = '';
    comp.tags.forEach(tag => {
        if (tag.type === 'pro') {
            tagsHtml += `<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#e6f4ea] text-[#137333] text-xs font-semibold">
                            <span class="material-symbols-outlined text-[14px]">check</span> ${tag.text}
                         </span>`;
        } else {
            tagsHtml += `<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary-container/20 text-secondary text-xs font-semibold">
                            <span class="material-symbols-outlined text-[14px]">warning</span> ${tag.text}
                         </span>`;
        }
    });

    const maxAmountLabel = comp.belopp_max ? `${(comp.belopp_max / 1000000).toLocaleString('sv-SE')} Mkr` : 'Ej angivet';

    card.innerHTML = `
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-surface-container-low pb-6">
            <div class="flex items-center gap-4">
                <div class="w-16 h-16 rounded-xl bg-surface-container flex items-center justify-center p-2">
                    <span class="font-headline font-bold text-primary text-sm text-center">${comp.bolag}</span>
                </div>
                <div>
                    <h3 class="font-headline font-bold text-xl text-on-surface">Livförsäkring</td>
                    <p class="text-sm text-on-surface-variant">${comp.bolag}</p>
                </div>
            </div>
            <div class="text-left sm:text-right">
                ${priceHtml}
            </div>
        </div>
        <div class="flex flex-wrap gap-3">
            <div class="bg-surface px-4 py-2 rounded-lg flex items-center gap-2">
                <span class="material-symbols-outlined text-primary text-sm">calendar_today</span>
                <span class="text-sm font-medium text-on-surface">Teckningsålder: ${comp.teckningsalder_min}-${comp.teckningsalder_max}</span>
            </div>
            <div class="bg-surface px-4 py-2 rounded-lg flex items-center gap-2">
                <span class="material-symbols-outlined text-primary text-sm">hourglass_empty</span>
                <span class="text-sm font-medium text-on-surface">Gäller till: ${comp.slutalder} år</span>
            </div>
            <div class="bg-surface px-4 py-2 rounded-lg flex items-center gap-2">
                <span class="material-symbols-outlined text-primary text-sm">payments</span>
                <span class="text-sm font-medium text-on-surface">Maxbelopp: ${maxAmountLabel}</span>
            </div>
        </div>
        <div class="flex flex-wrap gap-2">
            ${tagsHtml}
        </div>
        <div class="pt-6 border-t border-surface-container-low flex flex-col sm:flex-row justify-between items-center gap-4">
            <a class="text-sm font-semibold text-primary underline underline-offset-4 hover:text-secondary transition-colors" href="#">Läs fullständiga villkor</a>
            <button class="bg-gradient-to-br from-secondary-container to-secondary-fixed text-secondary font-bold px-8 py-3 rounded-xl hover:shadow-lg transition-all flex items-center gap-2 w-full sm:w-auto justify-center">
                Gå till bolaget <span class="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
        </div>
    `;
    return card;
}

function createDisqualifiedCard(comp) {
    const card = document.createElement('article');
    card.className = "bg-surface-container-lowest rounded-[24px] p-8 border border-outline-variant/30 opacity-60 flex flex-col gap-6 grayscale-[30%] mb-4";
    card.innerHTML = `
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-surface-container-low pb-6">
            <div class="flex items-center gap-4">
                <div class="w-16 h-16 rounded-xl bg-surface-container flex items-center justify-center p-2">
                   <span class="font-headline font-bold text-on-surface-variant text-sm text-center">${comp.bolag}</span>
                </div>
                <div>
                    <h3 class="font-headline font-bold text-xl text-on-surface">Livförsäkring</h3>
                    <p class="text-sm text-on-surface-variant">${comp.bolag}</p>
                </div>
            </div>
        </div>
        <div class="inline-flex self-start items-center gap-2 px-4 py-2 rounded-lg bg-error-container text-on-error-container text-sm font-semibold">
            <span class="material-symbols-outlined text-sm">error</span>
            ${comp.eliminationReason}
        </div>
    `;
    return card;
}

// Kärnlogik för att applicera saklig fakta
function processCompany(company, age, amount, job, scenario) {
    let result = { ...company, eliminated: false, eliminationReason: '', tags: [], calculatedPrice: null };

    // --- ELIMINERING ---
    if (age < company.teckningsalder_min || age > company.teckningsalder_max) {
        result.eliminated = true;
        result.eliminationReason = `Åldersgräns (Tecknas upp till ${company.teckningsalder_max} år)`;
    }
    if (amount > 0 && company.belopp_max !== null && amount > company.belopp_max) {
        result.eliminated = true;
        result.eliminationReason = `Maxbeloppet är ${(company.belopp_max / 1000000).toLocaleString('sv-SE')} Mkr — matchar ej önskat belopp`;
    }
    if (amount > 0 && amount < company.belopp_min) {
        result.eliminated = true;
        result.eliminationReason = `Minimibeloppet är ${(company.belopp_min / 1000000).toLocaleString('sv-SE')} Mkr — matchar ej önskat belopp`;
    }
    if (job === 'sjukskriven' && company.krav_arbetsfor === true) {
        result.eliminated = true;
        result.eliminationReason = `Kräver att du är fullt arbetsför.`;
    }

    // --- UPPSKATTAT PRIS ---
    let basePrice = null;
    if (age <= 40) basePrice = company.pris_30;
    else if (age <= 55) basePrice = company.pris_50;
    else if (age <= 62) basePrice = company.pris_60;
    else basePrice = company.pris_65;

    if (basePrice) {
        const amountRatio = amount / 2000000;
        result.calculatedPrice = Math.round(basePrice * amountRatio);
    }

    // --- SAKLIGA TAGGAR PROS/CONS ---
    if (company.slutalder >= 80) {
        result.tags.push({ type: 'pro', text: `Gäller extremt länge (${company.slutalder} år)` });
    }
    if (company.sankt_belopp_alder) {
        result.tags.push({ type: 'con', text: `Nedtrappning från ${company.sankt_belopp_alder} år` });
    } else {
        result.tags.push({ type: 'pro', text: `Ingen nedtrappning` });
    }

    if (scenario === 'elitsport') {
        if (company.undantag_sport.length > 0) {
            result.tags.push({ type: 'con', text: `Sportundantag` });
        } else {
            result.tags.push({ type: 'pro', text: `Inga sportundantag` });
        }
    }
    if (scenario === 'utlands') {
        if (company.krav_sverige) {
            result.tags.push({ type: 'con', text: `Kräver boende i Norden` });
        } else {
            result.tags.push({ type: 'pro', text: `OK utomlands` });
        }
    }

    return result;
}
