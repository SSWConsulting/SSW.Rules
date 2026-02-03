export function selectLatestRuleFilesByPath(files: Array<{ path: string; mergedAt: string | null }>) {
    const ruleMap = new Map<string, { path: string; mergedAt: string | null }>();

    files.forEach(file => {
        // Normalize path to match ruleUriFromPath logic
        const normalizedPath = file.path
            .replace(/\/rule\.md$/, "/rule.mdx")  // Convert .md to .mdx
            .replace(/^(public\/uploads\/rules|rules)\//, "")  // Remove prefixes
            .replace(/\/rule\.mdx$/, "");  // Remove suffix
        
        if (!normalizedPath) return;
        
        const existing = ruleMap.get(normalizedPath);
        
        // If no existing entry, or if new entry should be preferred based on mergedAt
        if (
            !existing || // no existing entry
            (file.mergedAt && !existing.mergedAt) || // prefer dated over undated
            (file.mergedAt && existing.mergedAt && new Date(file.mergedAt) > new Date(existing.mergedAt)) // later date wins
        ) {
            ruleMap.set(normalizedPath, file);
        }
    });

    return Array.from(ruleMap.values());
}