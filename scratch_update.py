import os

def update_file(path, tasks):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    for old, new in tasks:
        content = content.replace(old, new)
        
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

# 1. Stock Alert
update_file(
    r'd:\PROJECT\salon-next\app\api\cron\wa-stock-alert\route.ts',
    [
        (
            "import { sendWhatsApp } from '@/lib/fonnte';",
            "import { sendWhatsApp } from '@/lib/fonnte';\nimport { hasRunToday, markAsRun } from '@/lib/cronDedup';"
        ),
        (
            "const fonnteToken = settings?.fonnteToken ? String(settings.fonnteToken).trim() : undefined;\r\n\r\n        if (!adminPhone) {",
            "const fonnteToken = settings?.fonnteToken ? String(settings.fonnteToken).trim() : undefined;\r\n\r\n        if (await hasRunToday('stock_alert', tenantSlug)) {\r\n            return NextResponse.json({ success: true, message: 'Stock alert already sent today', sent: 0, skipped: true });\r\n        }\r\n\r\n        if (!adminPhone) {"
        ),
        (
            "            await Product.updateMany(\r\n                { _id: { $in: ids } },\r\n                { $set: { lowStockNotifSent: true } }\r\n            );\r\n        }",
            "            await Product.updateMany(\r\n                { _id: { $in: ids } },\r\n                { $set: { lowStockNotifSent: true } }\r\n            );\r\n            await markAsRun('stock_alert', tenantSlug, 'cron_route');\r\n        }"
        )
    ]
)

# 2. Membership Expiry
update_file(
    r'd:\PROJECT\salon-next\app\api\cron\wa-membership-expiry\route.ts',
    [
        (
            "import { sendWhatsApp } from \"@/lib/fonnte\";",
            "import { sendWhatsApp } from \"@/lib/fonnte\";\nimport { hasRunToday, markAsRun } from '@/lib/cronDedup';"
        ),
        (
            "const fonnteToken = settings?.fonnteToken ? String(settings.fonnteToken).trim() : undefined;\r\n\r\n        const today = new Date();",
            "const fonnteToken = settings?.fonnteToken ? String(settings.fonnteToken).trim() : undefined;\r\n\r\n        if (await hasRunToday('membership_expiry', tenantSlug)) {\r\n            return NextResponse.json({ success: true, message: 'Membership expiry already sent today', sent: 0, skipped: true });\r\n        }\r\n\r\n        const today = new Date();"
        ),
        (
            "        return NextResponse.json({\r\n            success: true,",
            "        await markAsRun('membership_expiry', tenantSlug, 'cron_route');\r\n\r\n        return NextResponse.json({\r\n            success: true,"
        )
    ]
)

# 3. Package Expiry
update_file(
    r'd:\PROJECT\salon-next\app\api\cron\wa-package-expiry\route.ts',
    [
        (
            "import { sendWhatsApp } from \"@/lib/fonnte\";",
            "import { sendWhatsApp } from \"@/lib/fonnte\";\nimport { hasRunToday, markAsRun } from '@/lib/cronDedup';"
        ),
        (
            "const fonnteToken = settings?.fonnteToken ? String(settings.fonnteToken).trim() : undefined;\r\n\r\n        const today = new Date();",
            "const fonnteToken = settings?.fonnteToken ? String(settings.fonnteToken).trim() : undefined;\r\n\r\n        if (await hasRunToday('package_expiry', tenantSlug)) {\r\n            return NextResponse.json({ success: true, message: 'Package expiry already sent today', sent: 0, skipped: true });\r\n        }\r\n\r\n        const today = new Date();"
        ),
        (
            "        return NextResponse.json({\r\n            success: true,",
            "        await markAsRun('package_expiry', tenantSlug, 'cron_route');\r\n\r\n        return NextResponse.json({\r\n            success: true,"
        )
    ]
)

# 4. Birthday Voucher
update_file(
    r'd:\PROJECT\salon-next\app\api\cron\birthday-voucher\route.ts',
    [
        (
            "import { sendWhatsApp } from \"@/lib/fonnte\";",
            "import { sendWhatsApp } from \"@/lib/fonnte\";\nimport { hasRunToday, markAsRun } from '@/lib/cronDedup';"
        ),
        (
            "const fonnteToken = settings?.fonnteToken ? String(settings.fonnteToken).trim() : undefined;\r\n\r\n    const voucher",
            "const fonnteToken = settings?.fonnteToken ? String(settings.fonnteToken).trim() : undefined;\r\n\r\n    if (await hasRunToday('birthday', tenantSlug)) {\r\n        return NextResponse.json({ success: true, message: 'Birthday voucher already sent today', sent: 0, skipped: true });\r\n    }\r\n\r\n    const voucher"
        ),
        (
            "    return NextResponse.json({\r\n      success: true,",
            "    await markAsRun('birthday', tenantSlug, 'cron_route');\r\n\r\n    return NextResponse.json({\r\n      success: true,"
        )
    ]
)

print('All cron routes updated')
