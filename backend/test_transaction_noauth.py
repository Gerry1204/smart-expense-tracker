import urllib.request
import json

data = json.dumps({
    "date": "2026-05-19",
    "amount": 100,
    "type": "expense",
    "category": "Food",
    "note": "test"
}).encode('utf-8')

req = urllib.request.Request('http://127.0.0.1:3000/transactions/', data=data, headers={'Content-Type': 'application/json'})

try:
    with urllib.request.urlopen(req) as response:
        print("Status Code:", response.getcode())
        print("Response:", response.read().decode())
except urllib.error.HTTPError as e:
    print("HTTP Error:", e.code)
    print("Response:", e.read().decode())
except Exception as e:
    print("Error:", e)
