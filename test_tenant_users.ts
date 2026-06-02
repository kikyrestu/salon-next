import { getTenantModels } from './lib/tenantDb';

async function main() {
    try {
        const { User } = await getTenantModels('pusat');
        const superAdmins = await User.find({}).select('+password').populate('role');
        console.log(`Found ${superAdmins.length} users with +password`);
        for (const admin of superAdmins) {
            const roleName = (admin as any).role?.name;
            console.log(`User: ${admin.email}, Role: ${roleName}, Password exists: ${!!admin.password}`);
            const isValid = await (admin as any).comparePassword('Kikyrestu1!');
            console.log(`Is Kikyrestu1! valid for ${admin.email}? ${isValid}`);
        }
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
main();
