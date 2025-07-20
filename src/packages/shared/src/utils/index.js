export function validateEnvironment(requiredVars) {
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
        console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
        process.exit(1);
    }
}
export function sanitizeQuery(query) {
    return query.trim().replace(/[<>]/g, '');
}
export function truncateText(text, maxLength) {
    if (text.length <= maxLength)
        return text;
    return text.slice(0, maxLength - 3) + '...';
}
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
export function generateId() {
    return Math.random().toString(36).substr(2, 9);
}
