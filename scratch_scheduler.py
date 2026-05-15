import os

path = r'd:\PROJECT\salon-next\lib\scheduler.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add imports
content = content.replace(
    "import { validateMessageContent } from '@/lib/messageValidator';",
    "import { validateMessageContent } from '@/lib/messageValidator';\nimport { hasRunToday, markAsRun } from '@/lib/cronDedup';"
)

# 1. daily_report
content = content.replace(
    "if (rule.category === 'daily_report') {\r\n                        if (targetPhones.length === 0) continue;",
    "if (rule.category === 'daily_report') {\r\n                        if (targetPhones.length === 0) continue;\r\n                        if (await hasRunToday('daily_report', slug)) continue;"
)
content = content.replace(
    "                        if (allSuccess) {\r\n                            rule.lastRunDate = now;\r\n                            await rule.save();\r\n                        }",
    "                        if (allSuccess) {\r\n                            rule.lastRunDate = now;\r\n                            await rule.save();\r\n                            await markAsRun('daily_report', slug, 'scheduler');\r\n                        }"
)

# 2. stock_alert
content = content.replace(
    "                    else if (rule.category === 'stock_alert') {\r\n                        if (targetPhones.length === 0) continue;",
    "                    else if (rule.category === 'stock_alert') {\r\n                        if (targetPhones.length === 0) continue;\r\n                        if (await hasRunToday('stock_alert', slug)) continue;"
)
content = content.replace(
    "                        if (result.success) {\r\n                            const ids = toNotify.map((p: any) => p._id);\r\n                            await Product.updateMany({ _id: { $in: ids } }, { $set: { lowStockNotifSent: true } });\r\n                            rule.lastRunDate = now;\r\n                            await rule.save();\r\n                        }",
    "                        if (result.success) {\r\n                            const ids = toNotify.map((p: any) => p._id);\r\n                            await Product.updateMany({ _id: { $in: ids } }, { $set: { lowStockNotifSent: true } });\r\n                            rule.lastRunDate = now;\r\n                            await rule.save();\r\n                            await markAsRun('stock_alert', slug, 'scheduler');\r\n                        }"
)

# 3. membership_expiry
content = content.replace(
    "                    else if (rule.category === 'membership_expiry' && rule.targetRole === 'customer') {\r\n                        const daysBefore = rule.daysBefore || 0;",
    "                    else if (rule.category === 'membership_expiry' && rule.targetRole === 'customer') {\r\n                        if (await hasRunToday('membership_expiry', slug)) continue;\r\n                        const daysBefore = rule.daysBefore || 0;"
)
content = content.replace(
    "                        rule.lastRunDate = now;\r\n                        await rule.save();\r\n                        console.log(`[AUTOMATION:membership_expiry] sent: ${memberSentCount} / ${customers.length}`);",
    "                        rule.lastRunDate = now;\r\n                        await rule.save();\r\n                        await markAsRun('membership_expiry', slug, 'scheduler');\r\n                        console.log(`[AUTOMATION:membership_expiry] sent: ${memberSentCount} / ${customers.length}`);"
)

# 4. package_expiry
content = content.replace(
    "                    else if (rule.category === 'package_expiry' && rule.targetRole === 'customer') {\r\n                        const daysBefore = rule.daysBefore || 0;",
    "                    else if (rule.category === 'package_expiry' && rule.targetRole === 'customer') {\r\n                        if (await hasRunToday('package_expiry', slug)) continue;\r\n                        const daysBefore = rule.daysBefore || 0;"
)
content = content.replace(
    "                        rule.lastRunDate = now;\r\n                        await rule.save();\r\n                        console.log(`[AUTOMATION:package_expiry] sent: ${pkgSentCount} / ${pkgTotal}`);",
    "                        rule.lastRunDate = now;\r\n                        await rule.save();\r\n                        await markAsRun('package_expiry', slug, 'scheduler');\r\n                        console.log(`[AUTOMATION:package_expiry] sent: ${pkgSentCount} / ${pkgTotal}`);"
)

# 5. birthday
content = content.replace(
    "                    else if (rule.category === 'birthday' && rule.targetRole === 'customer') {\r\n                        // BUG-06 FIX",
    "                    else if (rule.category === 'birthday' && rule.targetRole === 'customer') {\r\n                        if (await hasRunToday('birthday', slug)) continue;\r\n                        // BUG-06 FIX"
)
content = content.replace(
    "                        rule.lastRunDate = now;\r\n                        await rule.save();\r\n                        console.log(`[AUTOMATION:birthday] sent: ${bdaySentCount} / ${birthdayCustomers.length}`);",
    "                        rule.lastRunDate = now;\r\n                        await rule.save();\r\n                        await markAsRun('birthday', slug, 'scheduler');\r\n                        console.log(`[AUTOMATION:birthday] sent: ${bdaySentCount} / ${birthdayCustomers.length}`);"
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Scheduler dedup updated')
