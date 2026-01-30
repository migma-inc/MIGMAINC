import { useEffect } from 'react';
import { getContractTemplateByProductSlug, getChargebackAnnexTemplate } from '@/lib/contract-templates';
import type { VisaCheckoutActions } from '../types/form.types';

export const useTemplateLoader = (
    productSlug: string | undefined,
    selectedUpsell: 'none' | 'canada-premium' | 'canada-revolution',
    actions: VisaCheckoutActions
) => {
    const {
        setContractTemplate,
        setChargebackAnnexTemplate,
        setUpsellContractTemplate,
        setLoadingTemplate,
        setLoadingAnnexTemplate,
        setLoadingUpsellTemplate
    } = actions;

    useEffect(() => {
        const loadTemplates = async () => {
            if (!productSlug) return;

            // Load Main Contract Template
            setLoadingTemplate(true);
            try {
                const template = await getContractTemplateByProductSlug(productSlug);
                setContractTemplate(template);
            } catch (err) {
                console.error('Error loading main contract template:', err);
            } finally {
                setLoadingTemplate(false);
            }

            // Load Chargeback Annex Template
            setLoadingAnnexTemplate(true);
            try {
                const annex = await getChargebackAnnexTemplate(productSlug);
                setChargebackAnnexTemplate(annex);
            } catch (err) {
                console.error('Error loading chargeback annex template:', err);
            } finally {
                setLoadingAnnexTemplate(false);
            }
        };

        loadTemplates();
    }, [productSlug, setContractTemplate, setChargebackAnnexTemplate, setLoadingTemplate, setLoadingAnnexTemplate]);

    useEffect(() => {
        const loadUpsellTemplate = async () => {
            if (selectedUpsell === 'none') {
                setUpsellContractTemplate(null);
                return;
            }

            const upsellSlug = selectedUpsell === 'canada-premium' ? 'canada-tourist-premium' : 'canada-tourist-revolution';
            setLoadingUpsellTemplate(true);
            try {
                const template = await getContractTemplateByProductSlug(upsellSlug);
                setUpsellContractTemplate(template);
            } catch (err) {
                console.error('Error loading upsell contract template:', err);
            } finally {
                setLoadingUpsellTemplate(false);
            }
        };

        loadUpsellTemplate();
    }, [selectedUpsell, setUpsellContractTemplate, setLoadingUpsellTemplate]);
};
