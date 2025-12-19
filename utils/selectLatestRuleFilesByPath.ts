export function selectLatestRuleFilesByPath(files: any[]) {
    const uniqueRulesMap = new Map();

    files.forEach(file => {
        const path = file.path;
        const ruleName = path.replace(/^rules\//, '').replace(/\/rule\.md$/, '');

        if (!uniqueRulesMap.has(ruleName) || 
            new Date(file.lastUpdated) > new Date(uniqueRulesMap.get(ruleName).lastUpdated)) {
        uniqueRulesMap.set(ruleName, file);
        }
    });

    return Array.from(uniqueRulesMap.values());
}