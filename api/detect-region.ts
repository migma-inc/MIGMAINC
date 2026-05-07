export const config = { runtime: 'edge' };

export default function handler(request: Request) {
  const country = request.headers.get('x-vercel-ip-country') || '';
  let region: 'US' | 'BR' | 'OTHER' = 'OTHER';
  if (country === 'US') region = 'US';
  else if (country === 'BR') region = 'BR';
  return Response.json({ region, country });
}
