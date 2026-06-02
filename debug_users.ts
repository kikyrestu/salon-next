import mongoose from 'mongoose';
import { getTenantModels } from './lib/tenantDb';

async function main() {
  const { User, Role } = await getTenantModels('pusat'); // or appropriate slug
  const users = await User.find({}).select('+password').populate('role');
  for (const user of users) {
    const roleName = (user as any).role?.name;
    console.log(`User: ${user.name}, Role: ${roleName}, Password: ${user.password}`);
    // test password "12345678" or whatever
    const isValid = await (user as any).comparePassword('password123'); // example
    console.log(`- Valid with 'password123'? ${isValid}`);
  }
  process.exit(0);
}

main().catch(console.error);
