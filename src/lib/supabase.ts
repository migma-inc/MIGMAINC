import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env file.\n' +
    'Required: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY\n' +
    'Make sure to restart your dev server after updating .env file'
  );
}

// Validar formato da chave
if (!supabaseAnonKey.startsWith('eyJ')) {
  console.error('❌ VITE_SUPABASE_ANON_KEY format is incorrect!');
  console.error('Expected JWT token starting with "eyJ"');
  console.error('Current key starts with:', supabaseAnonKey.substring(0, 10));
}

// Criar uma única instância do cliente Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true, // Enable session persistence
    autoRefreshToken: true, // Automatically refresh tokens
    detectSessionInUrl: true, // Detect session in URL (for OAuth redirects)
  },
});

const functionsBaseUrl = (import.meta.env.VITE_FUNCTIONS_BASE_URL as string | undefined)?.replace(/\/$/, '');
const defaultFunctionsBaseUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1`;

function serializeFunctionBody(body: unknown): BodyInit | undefined {
  if (body == null) return undefined;
  if (
    typeof body === 'string' ||
    body instanceof FormData ||
    body instanceof Blob ||
    body instanceof ArrayBuffer ||
    body instanceof URLSearchParams
  ) {
    return body as BodyInit;
  }
  return JSON.stringify(body);
}

async function parseFunctionResponse(response: Response, responseType?: string) {
  if (responseType === 'blob') return response.blob();
  if (responseType === 'arrayBuffer') return response.arrayBuffer();
  if (responseType === 'text') return response.text();

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) return response.json();

  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

if (functionsBaseUrl && functionsBaseUrl !== defaultFunctionsBaseUrl) {
  const originalInvoke = supabase.functions.invoke.bind(supabase.functions);

  (supabase.functions as typeof supabase.functions & {
    invoke: typeof supabase.functions.invoke;
  }).invoke = async (functionName, options = {}) => {
    const invokeOptions = options as typeof options & { responseType?: string };
    const { data: sessionData } = await supabase.auth.getSession();
    const headers = new Headers(invokeOptions.headers as HeadersInit | undefined);
    const body = serializeFunctionBody(invokeOptions.body);

    if (!headers.has('apikey')) headers.set('apikey', supabaseAnonKey);
    if (!headers.has('authorization')) {
      headers.set('authorization', `Bearer ${sessionData.session?.access_token ?? supabaseAnonKey}`);
    }
    if (body && !(body instanceof FormData) && !headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }

    try {
      const response = await fetch(`${functionsBaseUrl}/${functionName}`, {
        method: invokeOptions.method ?? 'POST',
        headers,
        body,
      });
      const data = await parseFunctionResponse(response, invokeOptions.responseType);

      if (!response.ok) {
        const message = typeof data === 'object' && data && 'error' in data
          ? String((data as { error: unknown }).error)
          : `Function ${functionName} failed with status ${response.status}`;
        return { data: null, error: new Error(message) };
      }

      return { data, error: null };
    } catch (error) {
      return originalInvoke(functionName, options);
    }
  };
}

