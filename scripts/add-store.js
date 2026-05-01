require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema({
    name: String,
    slug: String,
    dbUri: String,
    isActive: Boolean
}, { timestamps: true });

async function addStore() {
    const args = process.argv.slice(2);
    if (args.length < 3) {
        console.error('❌ Penggunaan: node scripts/add-store.js <Nama Cabang> <Slug> <Database URI>');
        console.error('Contoh: node scripts/add-store.js "Cabang Bintaro" "bintaro" "mongodb+srv://..."');
        process.exit(1);
    }

    const [name, slug, dbUri] = args;

    try {
        console.log('Menghubungkan ke Master DB...');
        const conn = await mongoose.connect(process.env.MASTER_MONGODB_URI);
        const Store = conn.model('Store', storeSchema);
        
        const existing = await Store.findOne({ slug });
        if (existing) {
            console.log(`❌ Cabang dengan slug "${slug}" sudah ada!`);
            process.exit(1);
        }
        
        await Store.create({
            name,
            slug,
            dbUri,
            isActive: true
        });
        
        console.log(`✅ Berhasil menambahkan cabang: ${name} (${slug})`);
        console.log(`\nSilakan buka: http://localhost:3000/${slug}/login untuk mulai setup cabang baru.`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Gagal menambahkan cabang:', error);
        process.exit(1);
    }
}

addStore();
