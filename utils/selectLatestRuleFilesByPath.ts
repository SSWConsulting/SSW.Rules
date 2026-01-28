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
        
        // If no existing entry, or if new entry has later mergedAt
        if (!existing || 
            (file.mergedAt && existing.mergedAt && 
             new Date(file.mergedAt) > new Date(existing.mergedAt))) {
            ruleMap.set(normalizedPath, file);
        }
    });

    return Array.from(ruleMap.values());
}