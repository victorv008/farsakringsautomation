/**
 * DYNAMIC INSURANCE CARD RENDERER
 * Fetches data/insurance.json, filters based on user selections from
 * sessionStorage + sidebar controls, and renders result cards dynamically.
 * Sidebar changes trigger re-render in real time.
 * Handles desktop sidebar + mobile drawer UX.
 */

(function () {
    const wrapper = document.getElementById('results-wrapper');
    if (!wrapper) return;

    const userAge = parseInt(sessionStorage.getItem('ins_age')) || 32;
    const userAmount = parseInt(sessionStorage.getItem('ins_amount')) || 2500000;
    const scenarios = (sessionStorage.getItem('ins_scenarios') || 'standard').split(',');

    const banner = document.getElementById('context-banner');
    if (banner) {
        const amountFmt = new Intl.NumberFormat('sv-SE').format(userAmount);
        banner.innerHTML = `Baserat på dina val: <strong class="text-[#00595c]">${userAge} år, ${amountFmt} kr</strong>. Söker matchande försäkringar...`;
    }

    const defaultState = () => ({
        sortBy: 'price',
        toggles: {
            no_halso: false,
            no_nedtrappning: false,
            no_arbetsfor: false,
            long_term: false,
            no_sport: false,
        },
    });

    const state = {
        allInsurers: [],
        ...defaultState(),
        selectedBolag: null,
    };

    fetch('data/insurance.json')
        .then(r => r.json())
        .then(data => {
            state.allInsurers = data.bolag || data;
            buildBolagList(state.allInsurers);
            wireSidebar();
            wireMobileDrawer();
            applyAndRender();
        })
        .catch(err => {
            console.error('Failed to load insurance data:', err);
            wrapper.innerHTML = `<div class="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
                <span class="material-symbols-outlined text-red-400 text-3xl">error</span>
                <p class="text-red-600 font-headline font-bold mt-3">Kunde inte hämta försäkringsdata</p>
            </div>`;
        });

    // ── SIDEBAR WIRING ──
    function buildBolagList(insurers) {
        const list = document.getElementById('bolag-list');
        if (!list) return;
        state.selectedBolag = new Set(insurers.map(i => i.bolag));

        list.innerHTML = insurers.map(ins => `
            <label class="bolag-row group" data-bolag-row="${escapeAttr(ins.bolag)}">
                <input checked class="text-primary rounded focus:ring-primary h-4 w-4" type="checkbox" data-bolag="${escapeAttr(ins.bolag)}"/>
                <span class="bolag-name text-sm text-on-surface flex-1">${escapeHtml(ins.bolag)}</span>
                <span class="bolag-dot text-xs font-semibold text-[#00595c]/50"></span>
            </label>
        `).join('');
    }

    function wireSidebar() {
        document.querySelectorAll('input[name="sort"]').forEach(radio => {
            radio.addEventListener('change', () => {
                if (radio.checked) {
                    state.sortBy = radio.value;
                    applyAndRender();
                }
            });
        });

        document.querySelectorAll('#filter-panel input[data-filter]').forEach(cb => {
            cb.addEventListener('change', () => {
                state.toggles[cb.dataset.filter] = cb.checked;
                applyAndRender();
            });
        });

        document.querySelectorAll('#bolag-list input[data-bolag]').forEach(cb => {
            cb.addEventListener('change', () => {
                const name = cb.dataset.bolag;
                if (cb.checked) state.selectedBolag.add(name);
                else state.selectedBolag.delete(name);
                applyAndRender();
            });
        });

        const clearBtn = document.getElementById('clear-filters');
        if (clearBtn) clearBtn.addEventListener('click', resetFilters);
    }

    function wireMobileDrawer() {
        const sidebar = document.getElementById('sidebar');
        const backdrop = document.getElementById('mobile-backdrop');
        const fab = document.getElementById('mobile-filter-fab');
        const closeBtn = document.getElementById('mobile-close');

        const open = () => {
            sidebar.classList.add('is-open');
            backdrop.classList.add('is-open');
            document.body.classList.add('no-scroll');
        };
        const close = () => {
            sidebar.classList.remove('is-open');
            backdrop.classList.remove('is-open');
            document.body.classList.remove('no-scroll');
        };

        fab && fab.addEventListener('click', open);
        backdrop && backdrop.addEventListener('click', close);
        closeBtn && closeBtn.addEventListener('click', close);
        document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    }

    function resetFilters() {
        const d = defaultState();
        state.sortBy = d.sortBy;
        state.toggles = d.toggles;
        state.selectedBolag = new Set(state.allInsurers.map(i => i.bolag));

        document.querySelectorAll('input[name="sort"]').forEach(r => { r.checked = r.value === state.sortBy; });
        document.querySelectorAll('#filter-panel input[data-filter]').forEach(cb => { cb.checked = false; });
        document.querySelectorAll('#bolag-list input[data-bolag]').forEach(cb => { cb.checked = true; });

        applyAndRender();
    }

    // ── FILTER + SORT + RENDER PIPELINE ──
    function applyAndRender() {
        const { matched, excluded } = filterInsurers(state.allInsurers, userAge, userAmount, scenarios);

        const togglePass = ins => passesToggles(ins, state.toggles);

        const visibleMatched = matched
            .filter(ins => state.selectedBolag.has(ins.bolag))
            .filter(togglePass);

        const visibleExcluded = excluded.filter(ins => state.selectedBolag.has(ins.bolag));

        sortMatched(visibleMatched, state.sortBy);

        updateBolagListAnnotations(matched, togglePass);
        updateFilterChrome();

        renderResults(visibleMatched, visibleExcluded, userAge, userAmount);
    }

    function passesToggles(ins, t) {
        if (t.no_halso && ins.halso_deklaration) return false;
        if (t.no_nedtrappning && ins.nedtrappning) return false;
        if (t.no_arbetsfor && ins.krav_arbetsfor) return false;
        if (t.long_term && (!ins.slutalder || ins.slutalder < 85)) return false;
        if (t.no_sport && ins.undantag_sport && ins.undantag_sport.length > 0) return false;
        return true;
    }

    function sortMatched(list, sortBy) {
        if (sortBy === 'max_age') {
            list.sort((a, b) => (b.teckningsalder_max || 0) - (a.teckningsalder_max || 0));
        } else if (sortBy === 'max_amount') {
            list.sort((a, b) => (b.belopp_max || 0) - (a.belopp_max || 0));
        } else {
            list.sort((a, b) => (a.pris_30 || 99999) - (b.pris_30 || 99999));
        }
    }

    // Dim bolag rows that would not match the current non-bolag filters,
    // and update the bolag section heading with a live count.
    function updateBolagListAnnotations(matched, togglePass) {
        const matchedSet = new Set(matched.map(i => i.bolag));

        state.allInsurers.forEach(ins => {
            const row = document.querySelector(`.bolag-row[data-bolag-row="${cssEscape(ins.bolag)}"]`);
            if (!row) return;
            const dot = row.querySelector('.bolag-dot');
            const compatible = matchedSet.has(ins.bolag) && togglePass(ins);
            row.classList.toggle('is-incompat', !compatible);
            if (dot) dot.textContent = compatible ? '' : '–';
        });

        const heading = document.getElementById('bolag-heading');
        if (heading) {
            const selected = state.allInsurers.filter(i => state.selectedBolag.has(i.bolag)).length;
            heading.textContent = `Bolag (${selected} av ${state.allInsurers.length})`;
        }
    }

    function activeFilterCount() {
        let n = 0;
        Object.values(state.toggles).forEach(v => { if (v) n++; });
        if (state.sortBy !== 'price') n++;
        if (state.selectedBolag && state.selectedBolag.size !== state.allInsurers.length) n++;
        return n;
    }

    function updateFilterChrome() {
        const count = activeFilterCount();
        const clearBtn = document.getElementById('clear-filters');
        const spacer = document.getElementById('filter-spacer');
        const fabBadge = document.getElementById('fab-badge');

        if (clearBtn) {
            if (count > 0) {
                clearBtn.classList.remove('hidden');
                clearBtn.classList.add('flex');
                if (spacer) spacer.classList.add('hidden');
            } else {
                clearBtn.classList.add('hidden');
                clearBtn.classList.remove('flex');
                if (spacer) spacer.classList.remove('hidden');
            }
        }
        if (fabBadge) fabBadge.textContent = count > 0 ? String(count) : '';
    }

    // ── FILTERING LOGIC ──
    function filterInsurers(insurers, age, amount, scenarios) {
        const matched = [];
        const excluded = [];

        insurers.forEach(ins => {
            const reasons = [];

            if (ins.teckningsalder_max && age > ins.teckningsalder_max) {
                reasons.push(`Max teckningsålder är ${ins.teckningsalder_max} år`);
            }
            if (ins.teckningsalder_min && age < ins.teckningsalder_min) {
                reasons.push(`Min teckningsålder är ${ins.teckningsalder_min} år`);
            }
            if (ins.belopp_max && amount > ins.belopp_max) {
                const maxFmt = new Intl.NumberFormat('sv-SE').format(ins.belopp_max);
                reasons.push(`Maxbelopp ${maxFmt} kr — under önskat belopp`);
            }
            if (scenarios.includes('elitsport') && ins.undantag_sport && ins.undantag_sport.length > 0) {
                reasons.push(`Undantar riskfyllda sporter (${ins.undantag_sport.join(', ')})`);
            }

            if (reasons.length > 0) excluded.push({ ...ins, _reasons: reasons });
            else matched.push(ins);
        });

        return { matched, excluded };
    }

    // ── RENDER ──
    function renderResults(matched, excluded, age, amount) {
        const amountFmt = new Intl.NumberFormat('sv-SE').format(amount);

        if (banner) {
            banner.innerHTML = `Baserat på dina val: <strong class="text-[#00595c]">${age} år, ${amountFmt} kr</strong>. Vi har hittat ${matched.length} matchande försäkringar.`;
        }

        let html = `<div class="flex items-end justify-between mb-6">
            <h1 class="font-headline text-3xl font-extrabold text-[#00595c] tracking-tight">
                ${matched.length} försäkringar matchar dina uppgifter
            </h1>
        </div>`;

        if (matched.length === 0) {
            html += `<div class="bg-white rounded-2xl p-10 text-center border border-[#00595c]/10 shadow-sm">
                <span class="material-symbols-outlined text-5xl text-[#00595c]/40">search_off</span>
                <p class="mt-4 text-[#00595c]/80 font-headline font-bold text-lg">Inga bolag matchar dina filter</p>
                <p class="text-[#00595c]/60 mt-2 text-sm">Prova att rensa några av filtren.</p>
            </div>`;
        }

        matched.forEach((ins, i) => { html += renderCard(ins, i); });

        if (excluded.length > 0) {
            html += `<h2 class="font-headline text-lg font-bold text-[#00595c]/50 mb-1 mt-8">
                🚫 ${excluded.length} försäkringar som inte matchar fullt ut
            </h2>
            <p class="text-sm text-[#00595c]/40 mb-5">Dessa matchade inte dina uppgifter.</p>`;
            excluded.forEach(ins => { html += renderExcludedCard(ins); });
        }

        wrapper.innerHTML = html;

        wrapper.querySelectorAll('.result-card').forEach((c, i) => {
            setTimeout(() => c.classList.add('visible'), 60 + i * 70);
        });
    }

    function renderCard(ins, index) {
        const price = ins.pris_30;
        const priceFmt = price ? new Intl.NumberFormat('sv-SE').format(price) : '—';
        const monthlyPrice = price ? Math.round(price / 12) : null;
        const maxMkr = ins.belopp_max ? (ins.belopp_max / 1000000) : null;

        let badges = '';
        if (!ins.nedtrappning) badges += badge('check', 'Ingen nedtrappning', 'g');
        if (ins.nedtrappning) badges += badge('warning', `Nedtrappning från ${ins.nedtrappning_alder} år`, 'r');
        if (!ins.halso_deklaration) badges += badge('check', 'Ingen hälsodeklaration', 'g');
        if (ins.slutalder >= 85) badges += badge('check', `Gäller till ${ins.slutalder} år`, 'g');
        if (ins.krav_arbetsfor) badges += badge('info', 'Kräver fullt arbetsför', 'a');
        if (ins.undantag_sport && ins.undantag_sport.length > 0) badges += badge('info', 'Sportundantag', 'a');

        const ribbon = index === 0 ? `
            <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#0D7377] to-[#14a0a5] rounded-t-[24px]"></div>
            <span class="absolute top-4 right-6 bg-[#e8a838] text-white text-xs font-bold px-3 py-1 rounded-full">⭐ Bäst matchning</span>` : '';

        const logoName = ins.bolag.length > 12
            ? `<span class="text-[9px] leading-tight px-1">${escapeHtml(ins.bolag)}</span>`
            : `<span class="text-sm">${escapeHtml(ins.bolag)}</span>`;

        const link = ins.webbsida ? ins.webbsida : '#';

        return `<article class="result-card bg-white rounded-[24px] p-8 shadow-[0_12px_32px_rgba(26,28,28,0.06)] flex flex-col gap-6 relative overflow-hidden border border-[#00595c]/5 hover:shadow-[0_20px_48px_rgba(13,115,119,0.12)] transition-shadow mb-6">
    ${ribbon}
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 pb-6">
        <div class="flex items-center gap-4">
            <div class="w-16 h-16 rounded-xl bg-[#f2f9f9] flex items-center justify-center border border-[#00595c]/10">
                <span class="font-headline font-bold text-[#00595c] text-center">${logoName}</span>
            </div>
            <div>
                <h3 class="font-headline font-bold text-xl text-[#00595c]">Livförsäkring</h3>
                <p class="text-sm text-[#00595c]/60">${escapeHtml(ins.bolag)}${!ins.halso_deklaration ? ' · Ingen hälsodeklaration' : ''}</p>
            </div>
        </div>
        <div class="text-left sm:text-right shrink-0">
            <div class="font-headline text-3xl font-extrabold text-[#00595c]">${priceFmt} kr<span class="text-lg font-medium text-[#00595c]/50">/år</span></div>
            ${monthlyPrice ? `<p class="text-xs text-[#00595c]/50 mt-1">≈ ${monthlyPrice} kr/mån</p>` : ''}
        </div>
    </div>
    <div class="flex flex-wrap gap-3">
        <div class="bg-[#f2f9f9] px-3 py-2 rounded-lg flex items-center gap-2 border border-[#00595c]/5 text-sm font-medium text-[#00595c]"><span class="material-symbols-outlined text-sm">calendar_today</span>${ins.teckningsalder || `${ins.teckningsalder_min}–${ins.teckningsalder_max}`} år</div>
        <div class="bg-[#f2f9f9] px-3 py-2 rounded-lg flex items-center gap-2 border border-[#00595c]/5 text-sm font-medium text-[#00595c]"><span class="material-symbols-outlined text-sm">hourglass_empty</span>Gäller till ${ins.slutalder} år</div>
        ${maxMkr ? `<div class="bg-[#f2f9f9] px-3 py-2 rounded-lg flex items-center gap-2 border border-[#00595c]/5 text-sm font-medium text-[#00595c]"><span class="material-symbols-outlined text-sm">payments</span>Max ${maxMkr} Mkr</div>` : '<div class="bg-[#f2f9f9] px-3 py-2 rounded-lg flex items-center gap-2 border border-[#00595c]/5 text-sm font-medium text-[#00595c]"><span class="material-symbols-outlined text-sm">payments</span>Inget maxtak</div>'}
    </div>
    <div class="flex flex-wrap gap-2">${badges}</div>
    <div class="pt-4 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
        <a class="text-sm font-semibold text-[#00595c] underline underline-offset-4 hover:text-[#e8a838] transition-colors" href="${link}" target="_blank">Läs fullständiga villkor</a>
        <a href="${link}" target="_blank" class="bg-[#e8a838] text-white font-bold px-8 py-3 rounded-xl hover:bg-[#f0c273] transition-all flex items-center gap-2 no-underline">Gå till bolaget <span class="material-symbols-outlined text-sm">arrow_forward</span></a>
    </div>
</article>`;
    }

    function renderExcludedCard(ins) {
        const reason = ins._reasons[0] || 'Matchar inte kriterier';
        return `<article class="result-card excl bg-white/60 rounded-[24px] p-8 flex flex-col gap-4 border-2 border-dashed border-gray-200 mb-4">
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div class="flex items-center gap-4">
            <div class="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center border border-gray-200 opacity-50">
                <span class="font-headline font-bold text-gray-500 text-sm text-center">${escapeHtml(ins.bolag)}</span>
            </div>
            <div>
                <h3 class="font-headline font-bold text-xl text-gray-400 line-through">Livförsäkring</h3>
                <p class="text-sm text-gray-400">${escapeHtml(ins.bolag)}</p>
            </div>
        </div>
        <div class="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <span class="material-symbols-outlined text-red-400">block</span>
            <div>
                <p class="text-xs font-bold text-red-500 uppercase tracking-wide">Exkluderad</p>
                <p class="text-sm text-gray-600">${reason}</p>
            </div>
        </div>
    </div>
</article>`;
    }

    function badge(icon, text, type) {
        return `<span class="tg tg-${type}"><span class="material-symbols-outlined text-[14px]">${icon}</span>${text}</span>`;
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    function escapeAttr(s) { return escapeHtml(s); }
    function cssEscape(s) {
        return (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/"/g, '\\"');
    }
})();
