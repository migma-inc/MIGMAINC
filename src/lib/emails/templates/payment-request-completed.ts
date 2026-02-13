import { getLayoutHtml } from '../components/Layout';
import { sendEmail } from '../service';

export function getPaymentRequestCompletedHtml(
    sellerName: string,
    amount: number,
    proofUrl?: string
): string {
    const proofSection = proofUrl ? `
        <p style="margin: 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
            <a href="${proofUrl}" style="color: #CE9F48; text-decoration: underline;">Ver comprovante de pagamento</a>
        </p>
    ` : '';

    const content = `
        <!-- Alert Banner -->
        <tr>
            <td style="padding: 0 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                        <td style="padding: 25px; background: linear-gradient(135deg, #8E6E2F 0%, #CE9F48 50%, #8E6E2F 100%); border-radius: 8px; text-align: center;">
                            <h1 style="margin: 0 0 10px 0; font-size: 32px; font-weight: bold; color: #000000;">Pagamento Concluído!</h1>
                            <p style="margin: 0; font-size: 18px; color: #000000; font-weight: 600;">Seu pagamento foi processado</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
        <!-- Main Content -->
        <tr>
            <td style="padding: 0 40px 40px; background-color: #000000;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                        <td style="padding: 30px; background: linear-gradient(135deg, #1a1a1a 0%, #000000 100%); border-radius: 8px; border: 1px solid #CE9F48;">
                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                Olá ${sellerName},
                            </p>
                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                Sua solicitação de pagamento no valor de <strong style="color: #CE9F48;">$${amount.toFixed(2)} USD</strong> foi <strong style="color: #F3E196;">paga com sucesso</strong>!
                            </p>
                            ${proofSection}
                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                O valor deve estar disponível em sua conta em breve, dependendo do método de pagamento utilizado.
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

export async function sendPaymentRequestCompletedEmail(
    email: string,
    sellerName: string,
    amount: number,
    _requestId: string,
    proofUrl?: string
): Promise<boolean> {
    const html = getPaymentRequestCompletedHtml(sellerName, amount, proofUrl);
    const subject = 'Pagamento Concluído - MIGMA';
    return sendEmail({ to: email, subject, html });
}
