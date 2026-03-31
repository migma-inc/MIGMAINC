import requests
import json

url = "https://n8n.wartully.com.br/webhook/mentoriamigma"
payload = {
    "servico": "COS & Transfer",
    "plano_servico": "cos-selection-process",
    "nome_completo": "Matías Daniel Doren ",
    "whatsapp": "+14028121068",
    "email": "matiasdanieldoren@gmail.com",
    "valor_servico": "400.00",
    "vendedor": "LARISSA_COSTA",
    "quantidade_dependentes": 0
}

headers = {
    "Content-Type": "application/json"
}

try:
    response = requests.post(url, data=json.dumps(payload), headers=headers)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
