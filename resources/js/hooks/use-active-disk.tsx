import { createContext, useContext, type ReactNode } from 'react';

const DiskContext = createContext<string>('local');

export function DiskProvider({ disk, children }: { disk: string; children: ReactNode }) {
    return <DiskContext.Provider value={disk}>{children}</DiskContext.Provider>;
}

/**
 * Active disk key + a params object to spread into route() / payloads.
 * Returns {} for the local disk so URLs stay clean.
 */
export function useActiveDisk() {
    const disk = useContext(DiskContext);
    const params: Record<string, string> = disk === 'local' ? {} : { disk };
    return { disk, params };
}
