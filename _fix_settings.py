with open(r'd:\PROJECT\salon-next\app\api\settings\route.ts', 'r', encoding='utf-8', newline='') as f:
    content = f.read()

content = content.replace("currency: 'USD'", "currency: 'IDR'")
content = content.replace("timezone: 'UTC'", "timezone: 'Asia/Jakarta'")

with open(r'd:\PROJECT\salon-next\app\api\settings\route.ts', 'w', encoding='utf-8', newline='') as f:
    f.write(content)

print("Updated app/api/settings/route.ts")
