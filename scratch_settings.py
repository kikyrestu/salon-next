import os

path = r'd:\PROJECT\salon-next\app\api\settings\route.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "import { checkPermissionWithSession } from '@/lib/rbac';",
    "import { checkPermissionWithSession } from '@/lib/rbac';\nimport { encryptFonnteToken, decryptFonnteToken } from '@/lib/encryption';"
)

content = content.replace(
    "        return NextResponse.json({ success: true, data: settings });",
    "        if (settings.fonnteToken) {\r\n            settings.fonnteToken = decryptFonnteToken(settings.fonnteToken);\r\n        }\r\n        return NextResponse.json({ success: true, data: settings });"
)

content = content.replace(
    "        if (body.birthdayVoucherId === \"\") {",
    "        if (body.fonnteToken) {\r\n            body.fonnteToken = encryptFonnteToken(body.fonnteToken);\r\n        }\r\n\r\n        if (body.birthdayVoucherId === \"\") {"
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Settings API updated for token encryption')
