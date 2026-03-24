import { createContext, useContext, useState, type ReactNode } from 'react';

interface CacheData {
    team?: any[];
    orders?: any[];
    commissions?: any[];
    totalSales?: any;
    approvals?: any[];
    overview?: {
        teamSize: number;
        teamSales: number;
        ordersCount: number;
        conversionRate: number;
        topSellers: any[];
        recentOrders: any[];
    };
    lastFetched: Record<string, number>;
}

interface DashboardCacheContextType {
    cache: CacheData;
    setCacheValue: (key: keyof Omit<CacheData, 'lastFetched'>, value: any) => void;
    isCacheValid: (key: string, ttl?: number) => boolean;
}

const DashboardCacheContext = createContext<DashboardCacheContextType | undefined>(undefined);

export const DashboardCacheProvider = ({ children }: { children: ReactNode }) => {
    const [cache, setCache] = useState<CacheData>({
        lastFetched: {}
    });

    const setCacheValue = (key: keyof Omit<CacheData, 'lastFetched'>, value: any) => {
        setCache(prev => ({
            ...prev,
            [key]: value,
            lastFetched: {
                ...prev.lastFetched,
                [key]: Date.now()
            }
        }));
    };

    const isCacheValid = (key: string, ttl: number = 5 * 60 * 1000) => { // Default 5 minutes
        const lastFetched = cache.lastFetched[key];
        if (!lastFetched) return false;
        return Date.now() - lastFetched < ttl;
    };

    return (
        <DashboardCacheContext.Provider value={{ cache, setCacheValue, isCacheValid }}>
            {children}
        </DashboardCacheContext.Provider>
    );
};

export const useDashboardCache = () => {
    const context = useContext(DashboardCacheContext);
    if (context === undefined) {
        throw new Error('useDashboardCache must be used within a DashboardCacheProvider');
    }
    return context;
};
