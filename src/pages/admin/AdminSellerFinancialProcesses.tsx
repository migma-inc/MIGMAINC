import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { adminSupabase } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { FinancialProcessList } from '@/components/admin/FinancialProcessList';
import { ArrowLeft, Wallet } from 'lucide-react';

interface SellerInfo {
    id: string;
    seller_id_public: string;
    full_name: string;
    email: string;
}

export function AdminSellerFinancialProcesses() {
    const { sellerId } = useParams<{ sellerId: string }>();
    const [seller, setSeller] = useState<SellerInfo | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadSeller = async () => {
            if (!sellerId) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const { data: sellerData, error } = await adminSupabase
                    .from('sellers')
                    .select('id, seller_id_public, full_name, email')
                    .eq('seller_id_public', sellerId)
                    .single();

                if (error) {
                    console.error('Error loading seller:', error);
                } else {
                    setSeller(sellerData);
                }
            } catch (err) {
                console.error('Unexpected error loading seller:', err);
            } finally {
                setLoading(false);
            }
        };

        loadSeller();
    }, [sellerId]);

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-medium" />
            </div>
        );
    }

    if (!seller) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center flex-col gap-4">
                <p className="text-gray-400 text-lg">Seller not found</p>
                <Link to="/dashboard/sellers">
                    <Button variant="outline">Back to Sellers</Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-black via-[#1a1a1a] to-black p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <Link to="/dashboard/sellers" className="text-gray-400 hover:text-white transition-colors">
                                <ArrowLeft className="w-5 h-5" />
                            </Link>
                            <h1 className="text-xl sm:text-2xl font-bold migma-gold-text flex items-center gap-2">
                                <Wallet className="w-5 h-5 sm:w-6 sm:h-6" />
                                Financial Processes - {seller.full_name || seller.email}
                            </h1>
                        </div>
                        <p className="text-gray-400 text-xs sm:text-sm pl-7">
                            Seller ID: {seller.seller_id_public} | Manage financial processes for this seller's clients
                        </p>
                    </div>
                </div>

                {/* Content */}
                <FinancialProcessList isAdmin={true} sellerId={seller.seller_id_public} />
            </div>
        </div>
    );
}
