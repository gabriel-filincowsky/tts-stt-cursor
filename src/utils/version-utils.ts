export function meetsMinimumVersion(current: string, minimum: string): boolean {
    const currentParts = current.split('.').map(Number);
    const minimumParts = minimum.split('.').map(Number);
    
    for (let i = 0; i < Math.max(currentParts.length, minimumParts.length); i++) {
        const currentPart = currentParts[i] || 0;
        const minimumPart = minimumParts[i] || 0;
        
        if (currentPart > minimumPart) return true;
        if (currentPart < minimumPart) return false;
    }
    
    return true;
} 