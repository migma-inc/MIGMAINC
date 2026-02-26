import { useState, useEffect } from 'react';
import { getGeolocationFromIP } from '@/lib/contracts';

interface UserLocation {
    countryCode: string | null;
    isBrazil: boolean;
    loading: boolean;
    error: boolean;
}

export function useUserLocation() {
    const [location, setLocation] = useState<UserLocation>({
        countryCode: null,
        isBrazil: false,
        loading: true,
        error: false,
    });

    useEffect(() => {
        let isMounted = true;

        async function detectLocation() {
            try {
                console.log('[useUserLocation] Starting robust detection...');

                let ip = '';
                let geoCountryCode = '';

                // 1. Tentar obter IP e País em uma única chamada
                const ipServices = [
                    'https://ipapi.co/json/',
                    'https://ip-api.com/json',
                    'https://api.ipify.org?format=json'
                ];

                for (const service of ipServices) {
                    try {
                        console.log(`[useUserLocation] Fetching ${service}...`);
                        const response = await fetch(service, { signal: AbortSignal.timeout(4000) });
                        if (response.ok) {
                            const data = await response.json();
                            ip = data.ip || data.query || ip;
                            geoCountryCode = data.country_code || data.countryCode || geoCountryCode;
                            console.log(`[useUserLocation] Received from ${service}:`, { ip, geoCountryCode });
                            if (geoCountryCode) break;
                        }
                    } catch (e) {
                        console.warn(`[useUserLocation] Service ${service} error:`, e instanceof Error ? e.name : String(e));
                    }
                }

                // 2. Fallback geo lookup se necessário
                if (ip && !geoCountryCode) {
                    const geo = await getGeolocationFromIP(ip);
                    geoCountryCode = geo.country?.toUpperCase() || '';
                }

                // 3. Verificação de Timezone (Dedo-duro)
                const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                const isBrazilTimezone = timezone.includes('Sao_Paulo') ||
                    timezone.includes('Brasilia') ||
                    timezone.includes('Fortaleza') ||
                    timezone.includes('Manaus');

                console.log('[useUserLocation] Raw findings:', { ip, geoCountryCode, timezone });

                if (isMounted) {
                    const country = geoCountryCode.toUpperCase();

                    // LÓGICA DE DECISÃO:
                    // - Se detectamos um país e ele é BR -> Brasil
                    // - Se detectamos um país e ele NÃO é BR (ex: US) -> Fora (Ignore Timezone se IP confirma outro lugar)
                    // - Se não detectamos país nenhum, mas o fuso é BR -> Brasil
                    // - Caso contrário -> Fora do Brasil

                    let isBR = false;
                    if (country) {
                        isBR = country === 'BR' || country === 'BRA';
                    } else if (isBrazilTimezone) {
                        isBR = true;
                    }

                    console.log(`[useUserLocation] Decision -> isBrazil: ${isBR} (Reason: ${country ? 'IP Country ' + country : 'Timezone Fallback'})`);

                    setLocation({
                        countryCode: country || (isBrazilTimezone ? 'BR (TZ)' : null),
                        isBrazil: isBR,
                        loading: false,
                        error: false,
                    });
                }
            } catch (err) {
                console.error('[useUserLocation] Error in detectLocation:', err);
                if (isMounted) {
                    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                    const isBR = tz.includes('Sao_Paulo') || tz.includes('Brasilia');
                    setLocation((prev) => ({
                        ...prev,
                        loading: false,
                        error: true,
                        isBrazil: isBR
                    }));
                }
            }
        }

        detectLocation();

        return () => {
            isMounted = false;
        };
    }, []);

    return location;
}
