import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText } from 'lucide-react';

export function BookACallPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <Card className="max-w-3xl bg-black/50 border border-gold-medium/30 text-white">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-gold-light" />
            <CardTitle className="text-lg sm:text-xl">Book a Call</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-gray-300">
          <p className="text-sm sm:text-base">Esta página ainda não possui conteúdo específico no dashboard.</p>
          <p className="text-xs sm:text-sm text-gray-400 mt-2">
            Se precisar de alguma funcionalidade aqui, me avise e implemento.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
