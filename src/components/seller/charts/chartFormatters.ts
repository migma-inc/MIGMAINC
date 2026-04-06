export function formatPlainNumber(value: number, maximumFractionDigits = 2) {
    return value.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits,
    });
}

export function shortenServiceLabel(name: string) {
    const normalized = name.trim();
    const lower = normalized.toLowerCase();

    if (lower.includes('eb1') && lower.includes('revolution')) return 'EB1 Revolution Plan';
    if (lower.includes('eb1') && lower.includes('premium')) return 'EB1 Premium Plan';
    if (lower.includes('eb2') && lower.includes('revolution')) return 'EB2 Revolution Plan';
    if (lower.includes('eb2') && lower.includes('premium')) return 'EB2 Premium Plan';
    if (lower.includes('eb3')) return 'EB3 Visa';
    if (lower.includes('b1') || lower.includes('tourist-us') || lower.includes('turista americano')) {
        if (lower.includes('premium')) return 'B1/B2 Premium';
        if (lower.includes('revolution')) return 'B1/B2 Revolution';
        return 'B1/B2 Tourist';
    }
    if (lower.includes('canada')) {
        if (lower.includes('premium')) return 'Canada Premium';
        if (lower.includes('revolution')) return 'Canada Revolution';
        return 'Canada Tourist';
    }
    if (lower.includes('change of status') || lower.includes('cos')) return 'COS';
    if (lower.includes('f1') && lower.includes('initial')) return 'F1 Initial';
    if (lower.includes('transfer')) return 'Transfer';
    if (lower.includes('student')) return 'Student Visa';

    const cleaned = normalized
        .replace(/\(.*?\)/g, '')
        .replace(/\bfull process payment\b/gi, 'Full Process')
        .replace(/\bvisa\b/gi, '')
        .replace(/\bservice\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

    if (cleaned.length <= 24) return cleaned;

    return `${cleaned.slice(0, 21).trimEnd()}...`;
}
