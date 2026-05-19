import urllib.request

req = urllib.request.Request('http://127.0.0.1:3000/transactions/', method='OPTIONS', headers={
    'Origin': 'https://a14d7464e551f3.lhr.life',
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'Content-Type,X-Username'
})

try:
    with urllib.request.urlopen(req) as response:
        print("Status Code:", response.getcode())
        print("Headers:", response.headers)
except urllib.error.HTTPError as e:
    print("HTTP Error:", e.code)
    print("Headers:", e.headers)
except Exception as e:
    print("Error:", e)
