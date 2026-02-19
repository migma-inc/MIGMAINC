import { useOutletContext } from 'react-router-dom';
import { FinancialProcessList } from '@/components/admin/FinancialProcessList';

interface SellerContext {
    seller: {
        id: string;
        seller_id_public: string;
        full_name: string;
        email: string;
    };
}

export function SellerFinancialProcessesPage() {
    const { seller } = useOutletContext<SellerContext>();

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold migma-gold-text">Customer Financial Processes</h1>
                <p className="text-gray-400">
                    Track payments and generate links for your clients' processes.
                </p>
            </div>

            <FinancialProcessList
                isAdmin={false}
                sellerId={seller.seller_id_public}
            />
        </div>
    );
}
