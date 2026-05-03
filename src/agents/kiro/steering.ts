/**
 * Kiro steering file utilities.
 * Wraps shared markdown content with Kiro-specific YAML front-matter.
 */

export type KiroInclusion = 'always' | 'manual' | 'fileMatch';

/**
 * Wraps markdown content with Kiro YAML front-matter.
 *
 * @param content - The markdown content (from shared generators)
 * @param inclusion - How Kiro should load this file: 'always' (auto-loaded),
 *                    'manual' (user must reference via #), 'fileMatch' (loaded when matching files are read)
 * @param fileMatchPattern - Glob pattern for fileMatch inclusion (e.g. 'README*')
 */
export function wrapWithFrontMatter(
    content: string,
    inclusion: KiroInclusion = 'always',
    fileMatchPattern?: string,
): string {
    let fm = `---\ninclusion: ${inclusion}\n`;
    if (inclusion === 'fileMatch' && fileMatchPattern) {
        fm += `fileMatchPattern: '${fileMatchPattern}'\n`;
    }
    fm += '---\n\n';
    return fm + content;
}
