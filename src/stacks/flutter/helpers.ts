export function toCamel(s: string): string {
    const parts = s.replace(/-/g, '_').split('_');
    return parts[0] + parts.slice(1).map(p => p ? p[0].toUpperCase() + p.slice(1) : '').join('');
}

export function toPascal(s: string): string {
    return s.replace(/-/g, '_').split('_').map(p => p ? p[0].toUpperCase() + p.slice(1) : '').join('');
}

export function endpointConstName(
    method: string,
    path: string,
    usedNames: Set<string>,
    svcName: string,
): string {
    const segments = path.replace(/^\//, '').replace(/-/g, '_').split('/').filter(Boolean);
    const clean = segments.map(seg =>
        seg.startsWith('{') && seg.endsWith('}') ? `by_${seg.slice(1, -1)}` : seg,
    );
    const baseName = clean.length > 0 ? toCamel(clean.join('_')) : 'root';

    let constName = baseName;
    if (usedNames.has(constName)) {
        const m = method.toLowerCase();
        constName = m
            ? `${m}${baseName[0].toUpperCase()}${baseName.slice(1)}`
            : `${baseName}Path`;
    }
    if (usedNames.has(constName)) {
        constName = toCamel(`${svcName}_${constName}`);
    }
    usedNames.add(constName);
    return constName;
}
