import { getLayoutHtml } from '../components/Layout';
import { sendEmail } from '../service';

export function getPaymentRequestCreatedHtml(
    sellerName: string,
    amount: number
): string {
    const content = `
        <!-- Main Content -->
        <tr>
            <td style="padding: 0 40px 40px; background-color: #000000;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                        <td style="padding: 30px; background: linear-gradient(135deg, #1a1a1a 0%, #000000 100%); border-radius: 8px; border: 1px solid #CE9F48;">
                            <h1 style="margin: 0 0 20px 0; font-size: 28px; font-weight: bold; color: #F3E196; text-align: center; background: linear-gradient(180deg, #8E6E2F 0%, #F3E196 25%, #CE9F48 50%, #F3E196 75%, #8E6E2F 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                                Solicitação de Pagamento Criada
                            </h1>
                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                Olá ${sellerName},
                            </p>
                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                Sua solicitação de pagamento no valor de <strong style="color: #CE9F48;">$${amount.toFixed(2)} USD</strong> foi criada com sucesso e está aguardando aprovação.
                            </p>
                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                Você receberá uma notificação assim que sua solicitação for processada.
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

export async function sendPaymentRequestCreatedEmail(
    email: string,
    sellerName: string,
    amount: number,
    _requestId: string
): Promise<boolean> {
    const html = getPaymentRequestCreatedHtml(sellerName, amount);
    const subject = 'Solicitação de Pagamento Criada - MIGMA';
    return sendEmail({ to: email, subject, html });
}
