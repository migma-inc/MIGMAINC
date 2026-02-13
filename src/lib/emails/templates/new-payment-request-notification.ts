import { getLayoutHtml } from '../components/Layout';
import { sendEmail } from '../service';

export function getNewPaymentRequestNotificationHtml(
    sellerName: string,
    sellerId: string,
    amount: number,
    paymentMethod: string
): string {
    const content = `
        <!-- Main Content -->
        <tr>
            <td style="padding: 0 40px 40px; background-color: #000000;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                        <td style="padding: 30px; background: linear-gradient(135deg, #1a1a1a 0%, #000000 100%); border-radius: 8px; border: 1px solid #CE9F48;">
                            <h1 style="margin: 0 0 20px 0; font-size: 28px; font-weight: bold; color: #F3E196; text-align: center; background: linear-gradient(180deg, #8E6E2F 0%, #F3E196 25%, #CE9F48 50%, #F3E196 75%, #8E6E2F 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                                Nova Solicitação de Pagamento
                            </h1>
                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                Uma nova solicitação de pagamento foi criada e requer sua atenção.
                            </p>
                            <div style="padding: 20px; background-color: #1a1a1a; border-radius: 8px; margin: 20px 0;">
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                    <tr>
                                        <td style="padding-bottom: 10px;">
                                            <p style="margin: 0 0 5px 0; font-size: 14px; color: #999999;">Seller</p>
                                            <p style="margin: 0; font-size: 18px; font-weight: bold; color: #F3E196;">${sellerName}</p>
                                            <p style="margin: 5px 0 0 0; font-size: 14px; color: #999999;">ID: ${sellerId}</p>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 15px 0 10px; border-top: 1px solid #333;">
                                            <p style="margin: 0 0 5px 0; font-size: 14px; color: #999999;">Valor</p>
                                            <p style="margin: 0; font-size: 24px; font-weight: bold; color: #CE9F48;">$${amount.toFixed(2)} USD</p>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 15px 0 0; border-top: 1px solid #333;">
                                            <p style="margin: 0 0 5px 0; font-size: 14px; color: #999999;">Método de Pagamento</p>
                                            <p style="margin: 0; font-size: 16px; color: #e0e0e0; text-transform: capitalize;">${paymentMethod}</p>
                                        </td>
                                    </tr>
                                </table>
                            </div>
                            <p style="margin: 20px 0 0 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                Por favor, acesse o painel administrativo para revisar e processar esta solicitação.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    `;
    return getLayoutHtml(content);
}

export async function sendNewPaymentRequestNotification(
    adminEmail: string,
    sellerName: string,
    sellerId: string,
    amount: number,
    paymentMethod: string,
    _requestId: string
): Promise<boolean> {
    const html = getNewPaymentRequestNotificationHtml(sellerName, sellerId, amount, paymentMethod);
    const subject = `Nova Solicitação de Pagamento - ${sellerName} - $${amount.toFixed(2)}`;
    return sendEmail({ to: adminEmail, subject, html });
}
