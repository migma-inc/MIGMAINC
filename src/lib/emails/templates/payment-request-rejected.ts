import { getLayoutHtml } from '../components/Layout';
import { sendEmail } from '../service';

export function getPaymentRequestRejectedHtml(
    sellerName: string,
    amount: number,
    reason: string
): string {
    const content = `
        <!-- Main Content -->
        <tr>
            <td style="padding: 0 40px 40px; background-color: #000000;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                        <td style="padding: 30px; background: linear-gradient(135deg, #1a1a1a 0%, #000000 100%); border-radius: 8px; border: 1px solid #CE9F48;">
                            <h1 style="margin: 0 0 20px 0; font-size: 28px; font-weight: bold; color: #F3E196; text-align: center; background: linear-gradient(180deg, #8E6E2F 0%, #F3E196 25%, #CE9F48 50%, #F3E196 75%, #8E6E2F 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                                Solicitação de Pagamento Rejeitada
                            </h1>
                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                Olá ${sellerName},
                            </p>
                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                Infelizmente, sua solicitação de pagamento no valor de <strong style="color: #CE9F48;">$${amount.toFixed(2)} USD</strong> foi rejeitada.
                            </p>
                            <div style="padding: 15px; background-color: #1a1a1a; border-left: 3px solid #CE9F48; margin: 20px 0; border-radius: 4px;">
                                <p style="margin: 0 0 8px 0; font-size: 14px; color: #999999; text-transform: uppercase; letter-spacing: 0.5px;">Motivo da Rejeição</p>
                                <p style="margin: 0; font-size: 16px; color: #e0e0e0;">${reason}</p>
                            </div>
                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                O valor foi devolvido ao seu saldo disponível. Se você tiver dúvidas, entre em contato conosco.
                            </p>
                            <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                Atenciosamente,<br>
                                <strong style="color: #CE9F48;">Equipe MIGMA</strong>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    `;
    return getLayoutHtml(content);
}

export async function sendPaymentRequestRejectedEmail(
    email: string,
    sellerName: string,
    amount: number,
    reason: string,
    _requestId: string
): Promise<boolean> {
    const html = getPaymentRequestRejectedHtml(sellerName, amount, reason);
    const subject = 'Solicitação de Pagamento Rejeitada - MIGMA';
    return sendEmail({ to: email, subject, html });
}
