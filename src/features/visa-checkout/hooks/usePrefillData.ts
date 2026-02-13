import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { VisaCheckoutActions } from '../types/form.types';

export const usePrefillData = (
    productSlug: string | undefined,
    actions: VisaCheckoutActions
) => {
    const [searchParams] = useSearchParams();
    const prefillToken = searchParams.get('prefill');
    const billingToken = searchParams.get('billing_token');

    // Track if we are currently loading prefill data
    const [isLoadingPrefill, setIsLoadingPrefill] = useState(!!prefillToken || !!billingToken);
    const [sellerId, setSellerId] = useState<string | null>(null);

    useEffect(() => {
        const loadPrefillData = async () => {
            // Case 1: Standard Prefill Token
            if (prefillToken && productSlug) {
                try {
                    const { data, error } = await supabase
                        .from('checkout_prefill_tokens')
                        .select('*')
                        .eq('token', prefillToken)
                        .single();

                    if (!error && data && data.product_slug === productSlug) {
                        if (new Date(data.expires_at) >= new Date()) {
                            if (data.seller_id) setSellerId(data.seller_id);
                            const clientData = data.client_data;
                            if (clientData.clientName) actions.setClientName(clientData.clientName);
                            if (clientData.clientEmail) actions.setClientEmail(clientData.clientEmail);
                            if (clientData.clientWhatsApp) actions.setClientWhatsApp(clientData.clientWhatsApp);
                            if (clientData.clientCountry) actions.setClientCountry(clientData.clientCountry);
                            if (clientData.clientNationality) actions.setClientNationality(clientData.clientNationality);
                            if (clientData.dateOfBirth) actions.setDateOfBirth(clientData.dateOfBirth);
                            if (clientData.documentType) actions.setDocumentType(clientData.documentType);
                            if (clientData.documentNumber) actions.setDocumentNumber(clientData.documentNumber);
                            if (clientData.addressLine) actions.setAddressLine(clientData.addressLine);
                            if (clientData.city) actions.setCity(clientData.city);
                            if (clientData.state) actions.setState(clientData.state);
                            if (clientData.postalCode) actions.setPostalCode(clientData.postalCode);
                            if (clientData.maritalStatus) actions.setMaritalStatus(clientData.maritalStatus);
                            if (clientData.clientObservations) actions.setClientObservations(clientData.clientObservations);
                            if (typeof clientData.extraUnits === 'number') actions.setExtraUnits(clientData.extraUnits);
                            if (Array.isArray(clientData.dependentNames)) actions.setDependentNames(clientData.dependentNames);
                            // EB-3 Installment: pass schedule_id and fetch real-time data
                            if (clientData.eb3_schedule_id) {
                                actions.setEb3ScheduleId(clientData.eb3_schedule_id);

                                // 🛡️ BUSCA DADOS REAIS DO BANCO PARA SEGURANÇA
                                console.log('🛡️ [EB-3] Fetching installment data for ID:', clientData.eb3_schedule_id);
                                const { data: schedule, error: scheduleError } = await supabase
                                    .from('eb3_recurrence_schedules')
                                    .select('amount_usd, late_fee_usd, due_date, status')
                                    .eq('id', clientData.eb3_schedule_id)
                                    .single();

                                if (!scheduleError && schedule) {
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    const dueDate = new Date(schedule.due_date);
                                    dueDate.setHours(0, 0, 0, 0);

                                    const isOverdue = today > dueDate && schedule.status === 'pending';
                                    const lateFee = isOverdue ? Number(schedule.late_fee_usd) : 0;
                                    const finalAmount = Number(schedule.amount_usd) + lateFee;

                                    console.log('💰 [EB-3] Dynamic amount calculated:', finalAmount, isOverdue ? `(WITH LATE FEE: ${lateFee})` : '');
                                    actions.setEb3LateFee(lateFee);
                                    actions.setCustomAmount(finalAmount);
                                }
                            }
                            // Scholarship Maintenance Fee
                            if (clientData.scholarship_schedule_id) {
                                actions.setScholarshipScheduleId(clientData.scholarship_schedule_id);

                                // 🛡️ BUSCA DADOS REAIS DO BANCO PARA SEGURANÇA
                                console.log('🛡️ [Scholarship] Fetching installment data for ID:', clientData.scholarship_schedule_id);
                                const { data: schedule, error: scheduleError } = await supabase
                                    .from('scholarship_recurrence_schedules')
                                    .select('amount_usd, late_fee_usd, due_date, status')
                                    .eq('id', clientData.scholarship_schedule_id)
                                    .single();

                                if (!scheduleError && schedule) {
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    const dueDate = new Date(schedule.due_date);
                                    dueDate.setHours(0, 0, 0, 0);

                                    const isOverdue = today > dueDate && schedule.status === 'pending';
                                    const lateFee = isOverdue ? Number(schedule.late_fee_usd) : 0;
                                    const finalAmount = Number(schedule.amount_usd) + lateFee;

                                    console.log('💰 [Scholarship] Dynamic amount calculated:', finalAmount, isOverdue ? `(WITH LATE FEE: ${lateFee})` : '');
                                    actions.setScholarshipLateFee(lateFee);
                                    actions.setCustomAmount(finalAmount);
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.error('Error loading prefill:', err);
                }
            }

            // Case 2: Billing Token (Recurring)
            if (billingToken) {
                try {
                    console.log('🔄 [Billing] Loading installment data for token:', billingToken);
                    const { data: installment, error } = await supabase
                        .from('billing_installments')
                        .select(`
                            *,
                            schedule:recurring_billing_schedules(
                                order:visa_orders(*)
                            )
                        `)
                        .eq('checkout_token', billingToken)
                        .single();

                    if (error || !installment) {
                        console.error('Error loading billing data:', error);
                    } else if (installment.status === 'paid') {
                        actions.setError('This installment has already been paid. Thank you!');
                    } else {
                        const originalOrder = (installment.schedule as any).order;
                        console.log('✅ [Billing] Pre-filling from original order:', originalOrder.order_number);

                        // Populate client data
                        actions.setClientName(originalOrder.client_name);
                        actions.setClientEmail(originalOrder.client_email);
                        actions.setClientWhatsApp(originalOrder.client_whatsapp);
                        actions.setClientCountry(originalOrder.client_country);
                        actions.setClientNationality(originalOrder.client_nationality);

                        // Link this payment to the specific installment
                        actions.setBillingInstallmentId(installment.id);

                        // Auto-set additional units if present in original order
                        if (originalOrder.extra_units) {
                            actions.setExtraUnits(originalOrder.extra_units);
                            actions.setDependentNames(originalOrder.dependent_names || []);
                        }

                        // Jump to payment step if possible? 
                        // For now keep step 1 for review
                    }
                } catch (err) {
                    console.error('Unexpected billing prefill error:', err);
                }
            }

            setIsLoadingPrefill(false);
        };

        loadPrefillData();
    }, [prefillToken, billingToken, productSlug, actions]);

    return { isLoadingPrefill, sellerId };
};
