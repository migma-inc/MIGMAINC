import requests
import json
import time

# URL de produção do n8n
url = "https://n8n.wartully.com.br/webhook/mentoriamigma"

payloads = [
    # Payload Principal: Test User
    {
        "servico": "Transfer - Full Process Payment",
        "plano_servico": "Transfer - Full Process Payment",
        "nome_completo": "Test Applicant",
        "whatsapp": "+55 11 99999-9999",
        "email": "test@uorak.com",
        "valor_servico": "2200.00",
        "vendedor": "TEST_SELLER",
        "quantidade_dependentes": 1
    },
    # Dependente 1: Test Dependent
    {
        "tipo": "dependente",
        "nome_completo_cliente_principal": "Test Applicant",
        "nome_completo_dependente": "Test Dependent",
        "valor_servico": "150.00",
        "servico": "Transfer - Full Process Payment",
        "plano_servico": "Transfer - Full Process Payment",
        "email": "test@uorak.com",
        "whatsapp": "+55 11 99999-9999",
        "vendedor": "TEST_SELLER"
    }
]

headers = {
    "Content-Type": "application/json"
}

print(f"🧪 Iniciando envio de TESTE para: {url}\n")

for i, payload in enumerate(payloads):
    label = f"Dependente: {payload.get('nome_completo_dependente')}" if payload.get('tipo') == 'dependente' else f"Principal: {payload.get('nome_completo')}"
    
    try:
        print(f"[{i + 1}/{len(payloads)}] Enviando {label}...")
        response = requests.post(url, data=json.dumps(payload), headers=headers)
        print(f"✅ Status Code: {response.status_code}")
        if response.status_code != 200:
            print(f"⚠️ Response: {response.text}")
        
        time.sleep(1)
        
    except Exception as e:
        print(f"❌ Erro: {e}")

print("\n🏁 Processo de teste concluído.")
