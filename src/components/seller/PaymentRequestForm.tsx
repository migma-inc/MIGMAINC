import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DollarSign, CreditCard, Wallet, AlertCircle, Clock } from 'lucide-react';
import type { PaymentRequestFormData } from '@/types/seller';

interface PaymentRequestFormProps {
  availableBalance: number;
  onSubmit: (data: PaymentRequestFormData) => Promise<void>;
  isLoading?: boolean;
}

export function PaymentRequestForm({
  availableBalance,
  onSubmit,
  isLoading = false,
}: PaymentRequestFormProps) {
  const [formData, setFormData] = useState<PaymentRequestFormData>({
    amount: 0,
    payment_method: 'stripe',
    email: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string>('');

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (formData.amount <= 0) {
      newErrors.amount = 'Valor deve ser maior que zero';
    } else if (formData.amount > availableBalance) {
      newErrors.amount = `Valor não pode exceder o saldo disponível ($${availableBalance.toFixed(2)})`;
    }

    if (!formData.email || formData.email.trim() === '') {
      newErrors.email = 'Email é obrigatório';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email inválido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit({
        ...formData,
        email: formData.email.trim(),
      });
      // Reset form on success
      setFormData({
        amount: 0,
        payment_method: 'stripe',
        email: '',
      });
    } catch (error: any) {
      setSubmitError(error.message || 'Erro ao criar solicitação. Tente novamente.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Balance Cards in Modal Style - Inspired by Lus American */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-400 mb-1">Saldo Disponível</p>
                <p className="text-2xl font-bold text-gold-light">
                  ${availableBalance.toFixed(2)}
                </p>
              </div>
              <div className="w-12 h-12 bg-gold-medium/20 rounded-full flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-gold-light" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-400 mb-1">Saldo Pendente</p>
                <p className="text-2xl font-bold text-gold-light">
                  $0.00
                </p>
                <p className="text-xs text-gray-500 mt-1">Aguardando liberação</p>
              </div>
              <div className="w-12 h-12 bg-gold-medium/20 rounded-full flex items-center justify-center">
                <Clock className="w-6 h-6 text-gold-light" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Form Card */}
      <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
        <CardHeader className="border-b border-gold-medium/20 pb-4">
          <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Nova Solicitação de Pagamento
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {submitError && (
            <Alert className="bg-red-500/10 border-red-500/50">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <AlertDescription className="text-red-300 text-sm">
                {submitError}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="amount" className="block text-sm font-medium text-white">
              Valor (USD)
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                max={availableBalance}
                value={formData.amount || ''}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                className={`pl-10 pr-3 py-2 w-full bg-black/50 border-gold-medium/50 text-white rounded-lg ${
                  errors.amount 
                    ? 'border-red-500 bg-red-500/10' 
                    : 'focus:ring-2 focus:ring-gold-medium focus:border-gold-medium'
                }`}
                placeholder="0.00"
              />
            </div>
            {errors.amount && (
              <p className="text-sm text-red-400">{errors.amount}</p>
            )}
            <p className="text-xs text-gray-400">
              Máximo disponível: ${availableBalance.toFixed(2)}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment_method" className="block text-sm font-medium text-white">
              Método de Pagamento
            </Label>
            <Select
              value={formData.payment_method}
              onValueChange={(value) => setFormData({ ...formData, payment_method: value as 'stripe' | 'wise' })}
            >
              <SelectTrigger 
                id="payment_method"
                className="w-full bg-black/50 border-gold-medium/50 text-white rounded-lg"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stripe">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Stripe
                  </div>
                </SelectItem>
                <SelectItem value="wise">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    Wise
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="block text-sm font-medium text-white">
              Email da Conta
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className={`w-full bg-black/50 border-gold-medium/50 text-white rounded-lg ${
                errors.email 
                  ? 'border-red-500 bg-red-500/10' 
                  : 'focus:ring-2 focus:ring-gold-medium focus:border-gold-medium'
              }`}
              placeholder="example@email.com"
            />
            {errors.email && (
              <p className="text-sm text-red-400">{errors.email}</p>
            )}
            <p className="text-xs text-gray-400">
              Email da conta {formData.payment_method === 'stripe' ? 'Stripe' : 'Wise'}
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gold-medium/20">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFormData({ amount: 0, payment_method: 'stripe', email: '' });
                setErrors({});
                setSubmitError('');
              }}
              className="px-4 py-2 bg-black border border-gold-medium/50 text-white rounded-lg hover:bg-gold-medium/10"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading || availableBalance <= 0}
              className="px-6 py-2 bg-gold-medium hover:bg-gold-light text-black font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Enviando...' : 'Solicitar Pagamento'}
            </Button>
          </div>
        </form>
        </CardContent>
      </Card>
    </div>
  );
}
