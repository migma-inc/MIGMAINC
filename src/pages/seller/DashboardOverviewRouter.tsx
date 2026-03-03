import { useOutletContext } from 'react-router-dom';
import { SellerOverview } from './SellerOverview';
import { HeadOfSalesOverview } from './HeadOfSalesOverview';
import type { SellerInfo } from '@/types/seller';

export function DashboardOverviewRouter() {
    const { seller } = useOutletContext<{ seller: SellerInfo }>();

    if (seller.role === 'head_of_sales') {
        return <HeadOfSalesOverview />;
    }

    return <SellerOverview />;
}
