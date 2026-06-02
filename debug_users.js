// debug_users.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

async function main() {
    const mongoUri = process.env.MONGODB_URI;
    console.log("Connecting to:", mongoUri);
    const conn = mongoose.createConnection(mongoUri);

    const RoleSchema = new mongoose.Schema({ name: String });
    const Role = conn.model('Role', RoleSchema, 'Pusat_roles');

    const UserSchema = new mongoose.Schema({
        name: String,
        email: String,
        password: { type: String, select: true },
        role: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' }
    });
    // Add comparePassword method
    UserSchema.methods.comparePassword = async function(candidate) {
        try {
            return await bcrypt.compare(candidate, this.password);
        } catch(e) {
            return false;
        }
    };
    const User = conn.model('User', UserSchema, 'Pusat_users');

    const users = await User.find().populate('role');
    console.log(`Found ${users.length} users`);
    
    for(const u of users) {
        console.log(`- ${u.name} (${u.email}) | Role: ${u.role?.name}`);
        const isValid = await u.comparePassword('Kikyrestu1!');
        console.log(`  Password check with 'Kikyrestu1!': ${isValid}`);
    }

    process.exit(0);
}
main();
