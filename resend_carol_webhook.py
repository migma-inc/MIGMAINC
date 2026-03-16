import requests
import json
import time

# URL de produção do n8n
url = "https://n8n.wartully.com.br/webhook/mentoriamigma"

payloads = [
    # Payload Principal: Carol Anne
    {
        "servico": "Change of Status - Full Process Payment",
        "plano_servico": "Change of Status - Full Process Payment",
        "nome_completo": "Carol Anne Rosa",
        "whatsapp": "+14075876748",
        "email": "carolannerosa84@icloud.com",
        "valor_servico": "2200.00",
        "vendedor": "Seller",
        "quantidade_dependentes": 2
    },
    # Dependente 1: Miguel
    {
        "tipo": "dependente",
        "nome_completo_cliente_principal": "Carol Anne Rosa",
        "nome_completo_dependente": "Miguel Rosa Da Silva",
        "valor_servico": "150.00",
        "servico": "Change of Status - Full Process Payment",
        "plano_servico": "Change of Status - Full Process Payment",
        "email": "carolannerosa84@icloud.com",
        "whatsapp": "+14075876748",
        "vendedor": "Seller"
    },
    # Dependente 2: Davi
    {
        "tipo": "dependente",
        "nome_completo_cliente_principal": "Carol Anne Rosa",
        "nome_completo_dependente": "Davi Rosa Da Silva",
        "valor_servico": "150.00",
        "servico": "Change of Status - Full Process Payment",
        "plano_servico": "Change of Status - Full Process Payment",
        "email": "carolannerosa84@icloud.com",
        "whatsapp": "+14075876748",
        "vendedor": "Seller"
    }
]

headers = {
    "Content-Type": "application/json"
}

print(f"🚀 Iniciando reenvio de {len(payloads)} webhooks para: {url}\n")

for i, payload in enumerate(payloads):
    label = f"Dependente: {payload.get('nome_completo_dependente')}" if payload.get('tipo') == 'dependente' else f"Principal: {payload.get('nome_completo')}"
    
    try:
        print(f"[{i + 1}/{len(payloads)}] Enviando {label}...")
        response = requests.post(url, data=json.dumps(payload), headers=headers)
        print(f"✅ Status Code: {response.status_code}")
        if response.status_code != 200:
            print(f"⚠️ Response: {response.text}")
        
        # Pequeno delay entre envios para evitar rate limit se houver
        time.sleep(1)
        
    except Exception as e:
        print(f"❌ Erro: {e}")

print("\n🏁 Processo concluído.")
