require('dotenv').config({path:'.env.local'});
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function testLogin() {
    const conn = await mongoose.connect('mongodb+srv://kikyrestunov:Kikyrestu089@rekberder.zhb14.mongodb.net/salon_bintaro?retryWrites=true&w=majority&appName=RekberDer');
    const user = await conn.connection.collection('users').findOne({email: 'bintaro@salon.com'});
    console.log('User found:', user);
    
    if (user) {
        const isMatch = await bcrypt.compare('Password@123', user.password);
        console.log('Password match:', isMatch);
    }
    process.exit(0);
}
testLogin();
