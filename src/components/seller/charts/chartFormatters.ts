export function formatPlainNumber(value: number, maximumFractionDigits = 2) {
    return value.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits,
    });
}

export function formatCompactK(value: number) {
    if (value === 0) return '0';
    if (value >= 1000) {
        return (value / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    return formatPlainNumber(value, 2);
}

// Mapa exaustivo: slug → label curto padronizado
const SLUG_LABEL_MAP: Record<string, string> = {
    // EB-2
    'eb2-visa':                     'EB-2 Full Process',
    'eb2-niw-initial-payment':      'EB-2 Step 1 – Initial',
    'eb2-i140-step':                'EB-2 Step 2 – I-140',
    'eb2-i485-step':                'EB-2 Step 3 – I-485',
    'eb2-annex-installment':        'EB-2 Monthly Installment',
    // EB-3
    'eb3-visa':                     'EB-3 Full Process',
    'eb3-step-initial':             'EB-3 Step – Initial',
    'eb3-step-catalog':             'EB-3 Step – Catalog',
    'eb3-installment-initial':      'EB-3 Install. – Initial',
    'eb3-installment-catalog':      'EB-3 Install. – Catalog',
    'eb3-installment-monthly':      'EB-3 Install. Monthly',
    'eb3-vinicius':                 'EB-3 Vinícius',
    'eb3-vinicius-parte-2':         'EB-3 Vinícius Pt.2',
    // E-2 / L-1 / O-1
    'e2-l1-visa':                   'E-2 / L-1',
    'o1-visa':                      'O-1 Visa',
    // Initial (F1)
    'initial':                      'Initial (F1)',
    'initial-selection-process':    'Initial – Selection',
    'initial-scholarship':          'Initial – Scholarship',
    'initial-i20-control':          'Initial – I-20',
    // COS (Change of Status)
    'cos-selection-process':        'COS – Selection',
    'cos-scholarship':              'COS – Scholarship',
    'cos-i20-control':              'COS – I-20',
    // Transfer
    'transfer-selection-process':   'Transfer – Selection',
    'transfer-scholarship':         'Transfer – Scholarship',
    'transfer-i20-control':         'Transfer – I-20',
    // Full Process (slugs antigos com espaços)
    'INITIAL Application - Full Process Payment':  'Initial Full Process',
    'Change of Status - Full Process Payment':     'COS Full Process',
    'TRANSFER - Full Process Payment':             'Transfer Full Process',
    // B1/B2 Tourist (US)
    'b1-premium':                   'B1/B2 Premium',
    'b1-revolution':                'B1/B2 Revolution',
    'b1-basic':                     'B1/B2 Basic',
    // Canada
    'canada-tourist-premium':       'Canada Premium',
    'canada-tourist-revolution':    'Canada Revolution ETA',
    'canada-work':                  'Canada Work',
    // Specials
    'ceo-tourist-plan':             'CEO Tourist Plan',
    'sponsor-profissional':         'Professional Sponsor',
    'scholarship-maintenance-fee':  'Scholarship Fee',
    // Guides (PT)
    'visto-f1':                     'F-1 Visa Guide',
    'visto-b1-b2':                  'B1/B2 Guide',
    'extensao-status':              'Status Extension (I-539)',
    'troca-status':                 'Status Change Guide',
    // Consultations
    'consultation-brant':           'Consult. Brant',
    'consultation-common':          'Common Consult.',
    // Defense
    'rfe-defense':                  'RFE Defense',
    'visa-retry-defense':           'Retry Defense',
};

// Mapa de fallback por nome (para produtos cujo slug não foi reconhecido)
const NAME_KEYWORD_MAP: [string, string][] = [
    ['EB-2',          'EB-2'],
    ['EB-3',          'EB-3'],
    ['E-2',           'E-2 / L-1'],
    ['O-1',           'O-1'],
    ['B1 Premium',    'B1/B2 Premium'],
    ['B1 Revolution', 'B1/B2 Revolution'],
    ['Canada',        'Canada'],
    ['CEO Tourist',   'CEO Tourist'],
    ['Transfer',      'Transfer'],
    ['Change of Status', 'COS'],
    ['Initial',       'Initial'],
    ['Scholarship',   'Scholarship'],
    ['I-20',          'I-20 Control'],
    ['RFE',           'RFE Defense'],
    ['Defense',       'Defense'],
    ['Sponsor',       'Sponsor'],
    ['Consult',       'Consultation'],
];

export function shortenServiceLabel(nameOrSlug: string): string {
    if (!nameOrSlug) return 'Unknown';

    const trimmed = nameOrSlug.trim();

    // 1. Tentativa direta pelo slug/nome completo
    if (SLUG_LABEL_MAP[trimmed]) return SLUG_LABEL_MAP[trimmed];

    // 2. Tentativa case-insensitive pelo slug/nome
    const lowerTrimmed = trimmed.toLowerCase();
    for (const [slug, label] of Object.entries(SLUG_LABEL_MAP)) {
        if (slug.toLowerCase() === lowerTrimmed) return label;
    }

    // 3. Fallback por keywords no nome
    for (const [keyword, label] of NAME_KEYWORD_MAP) {
        if (trimmed.toLowerCase().includes(keyword.toLowerCase())) return label;
    }

    // 4. Truncar se muito longo
    if (trimmed.length <= 24) return trimmed;
    return `${trimmed.slice(0, 21).trimEnd()}...`;
}

