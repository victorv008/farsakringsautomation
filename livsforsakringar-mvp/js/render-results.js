(function () {
    const wrapper = document.getElementById('results-wrapper');
    if (!wrapper) return;

    const userAge = parseInt(sessionStorage.getItem('ins_age')) || 32;
    const userAmount = parseInt(sessionStorage.getItem('ins_amount')) || 2500000;
    const scenarios = (sessionStorage.getItem('ins_scenarios') || 'standard').split(',');

    const banner = document.getElementById('context-banner');
    if (banner) {
        const amountFmt = new Intl.NumberFormat('sv-SE').format(userAmount);
        banner.innerHTML = `Priser och villkor för: <strong class="text-[#00595c]">${userAge} år, ${amountFmt} kr</strong>. Hämtar försäkringar...`;
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
        const portal = document.getElementById('mobile-filter-portal');
        const portalContent = document.getElementById('mfp-content');
        const fab = document.getElementById('mobile-filter-fab');
        const closeBtn = document.getElementById('mfp-close');
        const applyBtn = document.getElementById('mfm-apply');
        const clearBtn = document.getElementById('mfm-clear');
        const filterPanel = document.getElementById('filter-panel');
        const sidebar = document.getElementById('sidebar');

        if (!portal || !portalContent || !fab || !filterPanel || !sidebar) return;

        const isMobile = () => window.innerWidth < 1024;
        let savedScrollY = 0;

        const lockBody = () => {
            savedScrollY = window.scrollY || window.pageYOffset;
            document.body.style.position = 'fixed';
            document.body.style.top = `-${savedScrollY}px`;
            document.body.style.left = '0';
            document.body.style.right = '0';
            document.body.style.width = '100%';
            document.body.classList.add('modal-open');
        };

        const unlockBody = () => {
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.left = '';
            document.body.style.right = '';
            document.body.style.width = '';
            document.body.classList.remove('modal-open');
            window.scrollTo(0, savedScrollY);
        };

        const open = () => {
            if (!isMobile() || portal.classList.contains('is-open')) return;
            portalContent.appendChild(filterPanel);
            portal.classList.add('is-open');
            portal.setAttribute('aria-hidden', 'false');
            lockBody();
        };

        const close = () => {
            if (!portal.classList.contains('is-open')) return;
            sidebar.appendChild(filterPanel);
            portal.classList.remove('is-open');
            portal.setAttribute('aria-hidden', 'true');
            unlockBody();
        };

        fab.addEventListener('click', () => {
            portal.classList.contains('is-open') ? close() : open();
        });
        if (closeBtn) closeBtn.addEventListener('click', close);
        if (applyBtn) applyBtn.addEventListener('click', close);
        if (clearBtn) clearBtn.addEventListener('click', resetFilters);

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

        // Split matched into verified (has price) and unverified (no price)
        const allMatched = matched.filter(ins => state.selectedBolag.has(ins.bolag)).filter(togglePass);
        const visibleMatched = allMatched.filter(ins => ins.pris_verifierad !== false);
        const visibleNoPrice = allMatched.filter(ins => ins.pris_verifierad === false);

        const visibleExcluded = excluded.filter(ins => state.selectedBolag.has(ins.bolag));

        sortMatched(visibleMatched, state.sortBy);

        updateBolagListAnnotations(matched, togglePass);
        updateFilterChrome();

        renderResults(visibleMatched, visibleExcluded, visibleNoPrice, userAge, userAmount);
    }

    function passesToggles(ins, t) {
        if (t.no_halso && ins.halso_deklaration) return false;
        if (t.no_nedtrappning && ins.nedtrappning) return false;
        if (t.no_arbetsfor && ins.krav_arbetsfor) return false;
        if (t.long_term && (!ins.slutalder || ins.slutalder < 85)) return false;
        if (t.no_sport && ins.undantag_sport && ins.undantag_sport.length > 0) return false;
        return true;
    }

    // ── DYNAMIC PRICE CALCULATION ──
    function calcMonthlyPrice(ins, age, amount) {
        const amountMkr = amount / 1000000;

        // --- JustInCase & Idun Liv: per-age per-amount table, interpolate both axes ---
        if ((ins.bolag === 'JustInCase' || ins.bolag === 'Idun Liv' || ins.bolag === 'Folksam') && ins.pris_tabell_mkr) {
            const tbl = ins.pris_tabell_mkr;
            const ages = Object.keys(tbl).map(Number).sort((a, b) => a - b);

            const lo = ages.filter(a => a <= age).pop() || ages[0];
            const hi = ages.filter(a => a > age)[0] || ages[ages.length - 1];

            const getPriceAtAge = (a) => {
                const amountsAtAge = tbl[String(a)] || tbl[a];
                if (!amountsAtAge) return null;
                const amtKeys = Object.keys(amountsAtAge).map(Number).sort((a, b) => a - b);
                return interpolate(amtKeys, v => amountsAtAge[v], amountMkr);
            };

            if (lo === hi) return Math.round(getPriceAtAge(lo));
            const frac = (age - lo) / (hi - lo);
            const loPrice = getPriceAtAge(lo);
            const hiPrice = getPriceAtAge(hi);
            return Math.round(loPrice + frac * (hiPrice - loPrice));
        }

        // --- Länsförsäkringar: age+amount table ---
        if (ins.bolag === 'Länsförsäkringar' && ins.pris_tabell_mkr) {
            const tbl = ins.pris_tabell_mkr;
            const ages = Object.keys(tbl).map(Number).sort((a, b) => a - b);
            const lo = ages.filter(a => a <= age).pop() || ages[0];
            const hi = ages.filter(a => a >= age)[0] || ages[ages.length - 1];
            const frac = lo === hi ? 0 : (age - lo) / (hi - lo);

            const getPriceAtAge = (a) => {
                const amountsAtAge = tbl[a];
                const amtKeys = Object.keys(amountsAtAge).map(Number).sort((a, b) => a - b);
                return interpolate(amtKeys, v => amountsAtAge[v], amountMkr);
            };
            return Math.round(getPriceAtAge(lo) + frac * (getPriceAtAge(hi) - getPriceAtAge(lo)));
        }

        // --- Skandia: age+amount table ---
        if (ins.bolag === 'Skandia' && ins.pris_tabell_mkr) {
            const tbl = ins.pris_tabell_mkr;
            const ages = Object.keys(tbl).map(Number).sort((a, b) => a - b);
            const lo = ages.filter(a => a <= age).pop() || ages[0];
            const hi = ages.filter(a => a >= age)[0] || ages[ages.length - 1];
            const frac = lo === hi ? 0 : (age - lo) / (hi - lo);

            const getPriceAtAge = (a) => {
                const amountsAtAge = tbl[a];
                const amtKeys = Object.keys(amountsAtAge).map(Number).sort((a, b) => a - b);
                return interpolate(amtKeys, v => amountsAtAge[v], amountMkr);
            };
            return Math.round(getPriceAtAge(lo) + frac * (getPriceAtAge(hi) - getPriceAtAge(lo)));
        }

        // --- Nordea: PBB-based table ---
        if (ins.bolag === 'Nordea' && ins.pris_tabell_pbb) {
            const pbb = ins.pris_pbb || 59200;
            const clampedAge = Math.max(16, Math.min(65, age));
            const pricePerPbb = ins.pris_tabell_pbb[String(clampedAge)];
            if (pricePerPbb) {
                const pbbUnits = amount / pbb;
                return Math.round(pricePerPbb * pbbUnits);
            }
        }

        // --- Handelsbanken: table for 1 184 000 kr ---
        if (ins.bolag === 'Handelsbanken Liv' && ins.pris_tabell) {
            const refAmount = ins.belopp_tabell_referens || 1184000;
            const tbl = ins.pris_tabell;
            const ages = Object.keys(tbl).map(Number).sort((a, b) => a - b);
            const priceAtRef = interpolate(ages, v => tbl[v], age);
            return Math.round(priceAtRef * (amount / refAmount));
        }

        // --- If: table per miljon ---
        if (ins.bolag === 'If' && ins.pris_tabell_1mkr) {
            const tbl = ins.pris_tabell_1mkr;
            const ages = Object.keys(tbl).map(Number).sort((a, b) => a - b);
            const priceAt1mkr = interpolate(ages, v => tbl[v], age);
            return Math.round(priceAt1mkr * amountMkr);
        }

        // --- SPP: table per miljon ---
        if (ins.bolag === 'SPP' && ins.pris_tabell_1mkr) {
            const tbl = ins.pris_tabell_1mkr;
            const ages = Object.keys(tbl).map(Number).sort((a, b) => a - b);
            const priceAt1mkr = interpolate(ages, v => tbl[v], age);
            return Math.round(priceAt1mkr * amountMkr);
        }

        // --- Generic: pris_tabell_1mkr as kr/mån per miljon ---
        if (ins.pris_tabell_1mkr && ins.pris_per_miljon) {
            const tbl = ins.pris_tabell_1mkr;
            const ages = Object.keys(tbl).map(Number).sort((a, b) => a - b);
            const pricePerMkr = interpolate(ages, v => tbl[v], age);
            return Math.round(pricePerMkr * amountMkr);
        }

        // --- Generic: pris_tabell as kr/mån per miljon ---
        if (ins.pris_tabell && ins.pris_per_miljon) {
            const tbl = ins.pris_tabell;
            const ages = Object.keys(tbl).map(Number).sort((a, b) => a - b);
            const pricePerMkr = interpolate(ages, v => tbl[v], age);
            return Math.round(pricePerMkr * amountMkr);
        }

        return null;
    }

    function interpolate(sortedKeys, getValue, x) {
        if (!sortedKeys || sortedKeys.length === 0) return null;
        const keys = sortedKeys.map(Number).sort((a, b) => a - b);

        if (x <= keys[0]) return getValue(keys[0]);
        if (x >= keys[keys.length - 1]) return getValue(keys[keys.length - 1]);

        const lo = keys.filter(k => k <= x).pop();
        const hi = keys.filter(k => k > x)[0];
        const loVal = getValue(lo);
        const hiVal = getValue(hi);
        if (loVal == null || hiVal == null) return loVal || hiVal;
        const frac = (x - lo) / (hi - lo);
        return loVal + frac * (hiVal - loVal);
    }

    function sortMatched(list, sortBy) {
        if (sortBy === 'max_age') {
            list.sort((a, b) => (b.teckningsalder_max || 0) - (a.teckningsalder_max || 0));
        } else if (sortBy === 'max_amount') {
            list.sort((a, b) => (b.belopp_max || 0) - (a.belopp_max || 0));
        } else {
            list.sort((a, b) => {
                const pa = calcMonthlyPrice(a, userAge, userAmount) || 99999;
                const pb = calcMonthlyPrice(b, userAge, userAmount) || 99999;
                return pa - pb;
            });
        }
    }

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
    function renderResults(matched, excluded, noPrice, age, amount) {
        const amountFmt = new Intl.NumberFormat('sv-SE').format(amount);

        if (banner) {
            banner.innerHTML = `Priser och villkor för: <strong class="text-[#00595c]">${age} år, ${amountFmt} kr</strong>. Vi lämnar ingen rådgivning – kontakta bolaget direkt för personlig rådgivning.`;
        }

        let html = `<div class="flex items-end justify-between mb-4 sm:mb-6">
            <h1 class="font-headline text-2xl sm:text-3xl font-extrabold text-[#00595c] tracking-tight">
                ${matched.length} försäkringar visas
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
                🚫 ${excluded.length} försäkringar filtrerades bort
            </h2>
            <p class="text-sm text-[#00595c]/40 mb-5">Matchar inte valda filterkriterier.</p>`;
            excluded.forEach(ins => { html += renderExcludedCard(ins); });
        }

        if (noPrice.length > 0) {
            html += `<h2 class="font-headline text-lg font-bold text-[#00595c]/40 mb-1 mt-10">
                Övriga bolag — pris ej tillgängligt
            </h2>
            <p class="text-sm text-[#00595c]/30 mb-5">Villkoren kan stämma för din situation. Kontakta bolaget för ett prisförslag.</p>`;
            noPrice.forEach(ins => { html += renderNoPriceCard(ins); });
        }

        wrapper.innerHTML = html;

        wrapper.querySelectorAll('.result-card').forEach((c, i) => {
            setTimeout(() => c.classList.add('visible'), 60 + i * 70);
        });
    }

    function renderCard(ins, index) {
        const monthlyPrice = calcMonthlyPrice(ins, userAge, userAmount);
        const isEstimated = ins.pris_estimerad === true;
        const priceFmt = monthlyPrice ? new Intl.NumberFormat('sv-SE').format(monthlyPrice) : '—';
        const pricePrefix = (monthlyPrice && isEstimated) ? '~ ' : '';
        const maxMkr = ins.belopp_max ? (ins.belopp_max / 1000000) : null;

        let badges = '';
        if (!ins.nedtrappning) badges += badge('check', 'Ingen nedtrappning', 'g');
        if (ins.nedtrappning) badges += badge('warning', `Nedtrappning från ${ins.nedtrappning_alder} år`, 'r');
        if (!ins.halso_deklaration) badges += badge('check', 'Ingen hälsodeklaration', 'g');
        if (ins.slutalder >= 85) badges += badge('check', `Gäller till ${ins.slutalder} år`, 'g');
        if (ins.krav_arbetsfor) badges += badge('info', 'Kräver fullt arbetsför', 'a');
        if (ins.undantag_sport && ins.undantag_sport.length > 0) badges += badge('info', 'Sportundantag', 'a');

        const ribbon = index === 0 && monthlyPrice ? `
            <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#0D7377] to-[#14a0a5] rounded-t-[20px]"></div>
            <span class="absolute top-3 right-4 bg-[#0D7377] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">💰 Lägst pris</span>` : '';

        const link = ins.webbsida ? ins.webbsida : '#';

        return `<article class="result-card bg-white rounded-[20px] sm:rounded-[24px] p-4 sm:p-8 shadow-[0_12px_32px_rgba(26,28,28,0.06)] flex flex-col gap-4 sm:gap-6 relative overflow-hidden border border-[#00595c]/5 hover:shadow-[0_20px_48px_rgba(13,115,119,0.12)] transition-shadow mb-4 sm:mb-6">
    ${ribbon}
    <div class="flex justify-between items-start gap-3 border-b border-gray-100 pb-4 sm:pb-6">
        <div class="flex items-center gap-3">
            <div class="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-white flex items-center justify-center border border-[#00595c]/10 overflow-hidden p-1.5 sm:p-2 shrink-0">
                ${ins.logo_url
                    ? `<img src="${ins.logo_url}" alt="${escapeAttr(ins.bolag)}" class="w-full h-full object-contain" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                       <span style="display:none" class="font-headline font-bold text-[#00595c] text-center text-[10px] leading-tight px-1 w-full flex items-center justify-center">${escapeHtml(ins.bolag)}</span>`
                    : `<span class="font-headline font-bold text-[#00595c] text-center text-xs leading-tight px-1">${escapeHtml(ins.bolag)}</span>`}
            </div>
            <div>
                <h3 class="font-headline font-bold text-base sm:text-xl text-[#00595c]">Livförsäkring</h3>
                <p class="text-xs sm:text-sm text-[#00595c]/60">${escapeHtml(ins.bolag)}${!ins.halso_deklaration ? ' · Ingen hälsodeklaration' : ''}</p>
            </div>
        </div>
        <div class="text-right shrink-0">
            <div class="font-headline text-2xl sm:text-3xl font-extrabold text-[#00595c]">${pricePrefix}${priceFmt} kr<span class="text-base sm:text-lg font-medium text-[#00595c]/50">/mån</span></div>
            ${monthlyPrice ? `<p class="text-xs text-[#00595c]/50 mt-1">≈ ${new Intl.NumberFormat('sv-SE').format(monthlyPrice * 12)} kr/år</p>` : ''}
        </div>
    </div>
    <div class="flex flex-wrap gap-2">
        <div class="bg-[#f2f9f9] px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 border border-[#00595c]/5 text-xs sm:text-sm font-medium text-[#00595c]"><span class="material-symbols-outlined text-sm">calendar_today</span>${ins.teckningsalder || `${ins.teckningsalder_min}–${ins.teckningsalder_max}`} år</div>
        <div class="bg-[#f2f9f9] px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 border border-[#00595c]/5 text-xs sm:text-sm font-medium text-[#00595c]"><span class="material-symbols-outlined text-sm">hourglass_empty</span>Gäller till ${ins.slutalder} år</div>
        ${maxMkr ? `<div class="bg-[#f2f9f9] px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 border border-[#00595c]/5 text-xs sm:text-sm font-medium text-[#00595c]"><span class="material-symbols-outlined text-sm">payments</span>Max ${maxMkr} Mkr</div>` : '<div class="bg-[#f2f9f9] px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 border border-[#00595c]/5 text-xs sm:text-sm font-medium text-[#00595c]"><span class="material-symbols-outlined text-sm">payments</span>Inget maxtak</div>'}
    </div>
    <div class="flex flex-wrap gap-1.5 sm:gap-2">${badges}</div>
    <div class="pt-3 sm:pt-4 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <a class="text-sm font-semibold text-[#00595c] underline underline-offset-4 hover:text-[#e8a838] transition-colors text-center sm:text-left" href="${link}" target="_blank">Läs fullständiga villkor</a>
        <a href="${link}" target="_blank" class="bg-[#e8a838] text-white font-bold px-6 py-3 rounded-xl hover:bg-[#f0c273] transition-all flex items-center justify-center gap-2 no-underline text-sm sm:text-base">Gå till bolaget <span class="material-symbols-outlined text-sm">arrow_forward</span></a>
    </div>
</article>`;
    }

    function renderNoPriceCard(ins) {
        const maxMkr = ins.belopp_max ? (ins.belopp_max / 1000000) : null;
        const link = ins.webbsida ? ins.webbsida : '#';

        let badges = '';
        if (!ins.nedtrappning) badges += badge('check', 'Ingen nedtrappning', 'g');
        if (ins.nedtrappning) badges += badge('warning', `Nedtrappning från ${ins.nedtrappning_alder} år`, 'r');
        if (!ins.halso_deklaration) badges += badge('check', 'Ingen hälsodeklaration', 'g');
        if (ins.slutalder >= 85) badges += badge('check', `Gäller till ${ins.slutalder} år`, 'g');
        if (ins.krav_arbetsfor) badges += badge('info', 'Kräver fullt arbetsför', 'a');
        if (ins.undantag_sport && ins.undantag_sport.length > 0) badges += badge('info', 'Sportundantag', 'a');

        return `<article class="result-card bg-white/70 rounded-[20px] sm:rounded-[24px] p-4 sm:p-8 flex flex-col gap-4 sm:gap-5 border border-dashed border-[#00595c]/15 mb-3 sm:mb-4 opacity-70 hover:opacity-90 transition-opacity">
    <div class="flex justify-between items-start gap-3 border-b border-gray-100 pb-4">
        <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center border border-gray-200 overflow-hidden p-1.5 shrink-0">
                ${ins.logo_url
                    ? `<img src="${ins.logo_url}" alt="${escapeAttr(ins.bolag)}" class="w-full h-full object-contain grayscale opacity-60" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                       <span style="display:none" class="font-headline font-bold text-gray-400 text-center text-[10px] leading-tight px-1 w-full flex items-center justify-center">${escapeHtml(ins.bolag)}</span>`
                    : `<span class="font-headline font-bold text-gray-400 text-center text-xs leading-tight px-1">${escapeHtml(ins.bolag)}</span>`}
            </div>
            <div>
                <h3 class="font-headline font-bold text-base sm:text-lg text-[#00595c]/60">Livförsäkring</h3>
                <p class="text-xs sm:text-sm text-[#00595c]/40">${escapeHtml(ins.bolag)}</p>
            </div>
        </div>
        <div class="text-right shrink-0">
            <div class="font-headline text-2xl sm:text-3xl font-extrabold text-gray-300">— kr<span class="text-base sm:text-lg font-medium text-gray-300">/mån</span></div>
            <p class="text-xs text-gray-400 mt-1">Pris ej tillgängligt</p>
        </div>
    </div>
    <div class="flex flex-wrap gap-2">
        <div class="bg-gray-50 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 border border-gray-100 text-xs sm:text-sm font-medium text-gray-500"><span class="material-symbols-outlined text-sm">calendar_today</span>${ins.teckningsalder || `${ins.teckningsalder_min}–${ins.teckningsalder_max}`} år</div>
        <div class="bg-gray-50 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 border border-gray-100 text-xs sm:text-sm font-medium text-gray-500"><span class="material-symbols-outlined text-sm">hourglass_empty</span>Gäller till ${ins.slutalder} år</div>
        ${maxMkr ? `<div class="bg-gray-50 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 border border-gray-100 text-xs sm:text-sm font-medium text-gray-500"><span class="material-symbols-outlined text-sm">payments</span>Max ${maxMkr} Mkr</div>` : '<div class="bg-gray-50 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 border border-gray-100 text-xs sm:text-sm font-medium text-gray-500"><span class="material-symbols-outlined text-sm">payments</span>Inget maxtak</div>'}
    </div>
    ${badges ? `<div class="flex flex-wrap gap-1.5 sm:gap-2">${badges}</div>` : ''}
    <div class="pt-3 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <a class="text-sm font-semibold text-[#00595c]/50 underline underline-offset-4 hover:text-[#00595c] transition-colors text-center sm:text-left" href="${link}" target="_blank">Läs fullständiga villkor</a>
        <a href="${link}" target="_blank" class="bg-gray-200 text-gray-600 font-bold px-6 py-3 rounded-xl hover:bg-gray-300 transition-all flex items-center justify-center gap-2 no-underline text-sm">Gå till bolaget <span class="material-symbols-outlined text-sm">arrow_forward</span></a>
    </div>
</article>`;
    }

    function renderExcludedCard(ins) {
        const reason = ins._reasons[0] || 'Matchar inte kriterier';
        return `<article class="result-card excl bg-white/60 rounded-[20px] sm:rounded-[24px] p-4 sm:p-8 flex flex-col gap-3 sm:gap-4 border-2 border-dashed border-gray-200 mb-3 sm:mb-4">
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div class="flex items-center gap-3">
            <div class="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-gray-100 flex items-center justify-center border border-gray-200 opacity-50">
                <span class="font-headline font-bold text-gray-500 text-xs sm:text-sm text-center">${escapeHtml(ins.bolag)}</span>
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
