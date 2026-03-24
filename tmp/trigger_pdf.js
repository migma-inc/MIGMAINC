
const url = "https://ekxftwrjvxtpnqbraszv.supabase.co/functions/v1/generate-visa-contract-pdf";
const headers = {
  "apikey": "sb_publishable_0FXGrzA2TDudVO_jCXRH6g_xNDsa0Xb",
  "Content-Type": "application/json"
};
const body = JSON.stringify({ order_id: "d3680f90-c429-47be-b5fd-f60b9a5d4e63" });

async function trigger() {
  const f = (u) => fetch(u, { method: "POST", headers, body }).then(r => r.json().then(d => ({ u, s: r.status, d })));
  const urls = [
    "https://ekxftwrjvxtpnqbraszv.supabase.co/functions/v1/generate-visa-contract-pdf",
    "https://ekxftwrjvxtpnqbraszv.supabase.co/functions/v1/generate-annex-pdf",
    "https://ekxftwrjvxtpnqbraszv.supabase.co/functions/v1/generate-invoice-pdf"
  ];
  const results = await Promise.all(urls.map(f));
  console.log(JSON.stringify(results, null, 2));
}

trigger();
