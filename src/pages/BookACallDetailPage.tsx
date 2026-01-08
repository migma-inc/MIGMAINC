import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText } from 'lucide-react';
import { useParams } from 'react-router-dom';

export function BookACallDetailPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <Card className="max-w-3xl bg-black/50 border border-gold-medium/30 text-white">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-gold-light" />
            <CardTitle className="text-lg sm:text-xl">Book a Call - Detalhe</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-gray-300 space-y-2">
          <p className="text-sm sm:text-base">Visualização de detalhes não implementada ainda.</p>
          {id && <p className="text-xs sm:text-sm text-gray-400">ID da solicitação: {id}</p>}
          <p className="text-xs sm:text-sm text-gray-400">
            Se precisar de informações adicionais nesta tela, me avise e adiciono.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
