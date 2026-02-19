import { FinancialProcessList } from '@/components/admin/FinancialProcessList';

export function FinancialProcessesPage() {
    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <FinancialProcessList isAdmin={true} />
        </div>
    );
}
