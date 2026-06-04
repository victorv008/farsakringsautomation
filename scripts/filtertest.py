#!/usr/bin/env python3
"""
Filtertest för livsforsakringar-mvp
Testar alla scenario-filter mot insurance.json
"""

import json
import sys
from pathlib import Path

# Läs insurance.json
data_path = Path(__file__).parent.parent / 'livsforsakringar-mvp' / 'data' / 'insurance.json'
with open(data_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

bolag_list = data['bolag']

# Testparametrar (samma som på sajten)
TEST_AGE = 32
TEST_AMOUNT = 2500000

def filter_insurers(insurers, age, amount, scenarios):
    """Simulerar filterInsurers() från render-results.js"""
    matched = []
    excluded = []

    for ins in insurers:
        reasons = []

        # Universella filter (ålder och belopp)
        if ins.get('teckningsalder_max') and age > ins['teckningsalder_max']:
            reasons.append(f"Max teckningsålder är {ins['teckningsalder_max']} år")
        if ins.get('teckningsalder_min') and age < ins['teckningsalder_min']:
            reasons.append(f"Min teckningsålder är {ins['teckningsalder_min']} år")
        if ins.get('belopp_max') and amount > ins['belopp_max']:
            reasons.append(f"Maxbelopp {ins['belopp_max']} kr — under önskat belopp")

        # Om "Jämför alla" (standard) är valt, hoppa över scenario-filter
        if 'standard' in scenarios:
            if reasons:
                excluded.append((ins['bolag'], reasons))
            else:
                matched.append(ins['bolag'])
            continue

        # Scenario-baserade filter
        if 'ingen_halso' in scenarios and ins.get('halso_deklaration') == True:
            reasons.append('Kräver hälsodeklaration')

        if 'barn' in scenarios:
            if ins.get('nedtrappning') == True:
                reasons.append('Beloppet trappas ner med åren — ej idealiskt med barn')
            if not ins.get('slutalder') or ins['slutalder'] < 85:
                reasons.append('Slutålder under 85 år — ej idealiskt för långsiktigt skydd')

        if 'ingen_nedtrappning' in scenarios and ins.get('nedtrappning') == True:
            reasons.append('Beloppet trappas ner med åren')

        if 'hog_slutalder' in scenarios and (not ins.get('slutalder') or ins['slutalder'] < 85):
            reasons.append('Slutålder under 85 år')

        if 'riskfylld_sport' in scenarios:
            undantag = ins.get('undantag_sport', [])
            if undantag and len(undantag) > 0:
                reasons.append(f"Undantar riskfyllda sporter ({', '.join(undantag)})")

        if 'utlands' in scenarios:
            if ins.get('krav_sverige') == True or ins.get('krav_sverige_detalj'):
                reasons.append('Kräver bosättning i Sverige/Norden')

        if 'arbetsfor' not in scenarios and ins.get('krav_arbetsfor') == True:
            reasons.append('Kräver fullt arbetsför')

        if reasons:
            excluded.append((ins['bolag'], reasons))
        else:
            matched.append(ins['bolag'])

    return matched, excluded

# Test-cases: (scenario_name, scenarios_list, expected_count, expected_bolag_if_specific)
tests = [
    ('standard (jämför alla)', ['standard'], 16, None),
    ('ingen_halso', ['ingen_halso'], 1, ['JustInCase']),
    ('barn', ['barn'], 3, ['Folksam', 'JustInCase', 'Movestic']),
    ('ingen_nedtrappning', ['ingen_nedtrappning'], 11, None),
    ('hog_slutalder', ['hog_slutalder'], 3, ['Folksam', 'JustInCase', 'Movestic']),
    ('riskfylld_sport', ['riskfylld_sport'], 14, None),
    ('utlands', ['utlands'], 0, []),
    ('arbetsfor (default - ingen vald)', [], 14, None),  # 16 - 2 som kräver arbetsför
]

print("=" * 70)
print("FILTERTEST: livsforsakringar-mvp")
print("=" * 70)
print(f"Test-parametrar: Ålder {TEST_AGE}, Belopp {TEST_AMOUNT:,} kr")
print("=" * 70)
print()

all_passed = True
for scenario_name, scenarios, expected_count, expected_bolag in tests:
    matched, excluded = filter_insurers(bolag_list, TEST_AGE, TEST_AMOUNT, scenarios)
    actual_count = len(matched)

    status = "✓ OK" if actual_count == expected_count else "✗ FAIL"

    if actual_count != expected_count:
        all_passed = False

    print(f"{status} | {scenario_name}")
    print(f"       Förväntat: {expected_count} bolag, Faktiskt: {actual_count} bolag")

    # Visa detaljer vid mismatch
    if actual_count != expected_count:
        print(f"       Visade bolag: {', '.join(matched)}")

    # Om vi förväntar specifika bolag, verifiera
    if expected_bolag is not None:
        expected_set = set(expected_bolag)
        actual_set = set(matched)
        if expected_set != actual_set:
            all_passed = False
            missing = expected_set - actual_set
            extra = actual_set - expected_set
            if missing:
                print(f"       ⚠ Saknade bolag: {', '.join(missing)}")
            if extra:
                print(f"       ⚠ Extra bolag: {', '.join(extra)}")

    print()

print("=" * 70)
if all_passed:
    print("🎉 ALLA TESTER PASSERADE")
    print("=" * 70)
    sys.exit(0)
else:
    print("🚨 ETT ELLER FLERA TESTER MISSLYCKADES")
    print("=" * 70)
    sys.exit(1)
