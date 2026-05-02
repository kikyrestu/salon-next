'use client';

import React, { useState, useEffect } from 'react';

export default function AdminCabangPage() {
    const [pin, setPin] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    
    const [activeTab, setActiveTab] = useState<'pending' | 'aktif' | 'settings'>('pending');
    
    // Data states
    const [branches, setBranches] = useState<any[]>([]);
    const [registrations, setRegistrations] = useState<any[]>([]);
    const [settings, setSettings] = useState({ fonnteToken: '', adminPhone: '', adminName: '' });
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Manual add form state
    const [showManualAdd, setShowManualAdd] = useState(false);
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [adminName, setAdminName] = useState('');
    const [adminEmail, setAdminEmail] = useState('');
    const [adminPassword, setAdminPassword] = useState('');

    useEffect(() => {
        const savedPin = sessionStorage.getItem('admin_pin');
        if (savedPin) {
            setPin(savedPin);
            authenticateAndLoadData(savedPin);
        }
    }, []);

    useEffect(() => {
        if (isAuthenticated) {
            loadDataForTab(activeTab);
        }
    }, [activeTab, isAuthenticated]);

    const authenticateAndLoadData = async (currentPin: string) => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/admin/registrations?status=pending', {
                headers: { 'x-admin-pin': currentPin }
            });
            const data = await res.json();
            
            if (res.ok && data.success) {
                setRegistrations(data.data);
                setIsAuthenticated(true);
                sessionStorage.setItem('admin_pin', currentPin);
                document.cookie = `admin_pin=${currentPin}; path=/; max-age=86400`;
            } else {
                setError(data.error || 'PIN Salah');
                sessionStorage.removeItem('admin_pin');
                setIsAuthenticated(false);
            }
        } catch (err: any) {
            setError(err.message || 'Gagal memuat data');
            setIsAuthenticated(false);
        } finally {
            setLoading(false);
        }
    };

    const loadDataForTab = async (tab: string) => {
        setLoading(true);
        try {
            if (tab === 'pending') {
                const res = await fetch('/api/admin/registrations?status=pending', { headers: { 'x-admin-pin': pin } });
                const data = await res.json();
                if (data.success) setRegistrations(data.data);
            } else if (tab === 'aktif') {
                const res = await fetch('/api/admin/branches', { headers: { 'x-admin-pin': pin } });
                const data = await res.json();
                if (data.success) setBranches(data.data);
            } else if (tab === 'settings') {
                const res = await fetch('/api/admin/settings', { headers: { 'x-admin-pin': pin } });
                const data = await res.json();
                if (data.success && data.data) setSettings({
                    fonnteToken: data.data.fonnteToken || '',
                    adminPhone: data.data.adminPhone || '',
                    adminName: data.data.adminName || 'Admin'
                });
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        authenticateAndLoadData(pin);
    };

    const handleApproveRegistration = async (id: string, storeName: string) => {
        if (!window.confirm(`Setujui pendaftaran toko "${storeName}" dan buatkan cabangnya?`)) return;
        
        setIsSubmitting(true);
        try {
            const res = await fetch(`/api/admin/registrations/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin },
                body: JSON.stringify({ action: 'approve' })
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message);
                loadDataForTab('pending');
            } else {
                alert(`Gagal: ${data.error}`);
            }
        } catch (error: any) {
            alert(`Error: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRejectRegistration = async (id: string, storeName: string) => {
        const reason = window.prompt(`Tolak pendaftaran toko "${storeName}"?\nMasukkan alasan penolakan (opsional):`);
        if (reason === null) return; // cancelled
        
        setIsSubmitting(true);
        try {
            const res = await fetch(`/api/admin/registrations/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin },
                body: JSON.stringify({ action: 'reject', rejectionReason: reason })
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message);
                loadDataForTab('pending');
            } else {
                alert(`Gagal: ${data.error}`);
            }
        } catch (error: any) {
            alert(`Error: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleToggleStatus = async (id: string, currentStatus: boolean, bSlug: string) => {
        if (bSlug === 'pusat') { alert('Cabang Pusat tidak bisa dinonaktifkan.'); return; }
        try {
            const res = await fetch(`/api/admin/branches/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin },
                body: JSON.stringify({ isActive: !currentStatus })
            });
            const data = await res.json();
            if (data.success) loadDataForTab('aktif');
            else alert(data.error || 'Gagal mengubah status cabang');
        } catch (err) { alert('Terjadi kesalahan jaringan'); }
    };

    const handleDeleteBranch = async (id: string, bName: string, bSlug: string) => {
        if (bSlug === 'pusat') { alert('Cabang Pusat tidak bisa dihapus.'); return; }
        if (!window.confirm(`Yakin ingin menghapus cabang "${bName}"? Data asli di database tidak akan terhapus, namun cabang ini tidak akan bisa diakses lagi.`)) return;
        try {
            const res = await fetch(`/api/admin/branches/${id}`, {
                method: 'DELETE',
                headers: { 'x-admin-pin': pin }
            });
            const data = await res.json();
            if (data.success) {
                loadDataForTab('aktif');
                alert(`Cabang "${bName}" berhasil dihapus dari sistem.`);
            } else alert(data.error || 'Gagal menghapus cabang');
        } catch (err) { alert('Terjadi kesalahan jaringan'); }
    };

    const handleSaveSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const res = await fetch('/api/admin/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin },
                body: JSON.stringify(settings)
            });
            const data = await res.json();
            if (data.success) alert('Pengaturan berhasil disimpan');
            else alert(data.error || 'Gagal menyimpan pengaturan');
        } catch (err: any) {
            alert('Terjadi kesalahan jaringan');
        } finally {
            setIsSubmitting(false);
        }
    };

    const generateSlug = (val: string) => val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    const handleManualAddBranch = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const res = await fetch('/api/admin/branches', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin },
                body: JSON.stringify({ name, slug })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);

            await new Promise(r => setTimeout(r, 500));

            const setupRes = await fetch('/api/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-store-slug': slug },
                body: JSON.stringify({ name: adminName, email: adminEmail, password: adminPassword })
            });
            const setupData = await setupRes.json();
            if (!setupData.success) {
                const branchList = await fetch('/api/admin/branches', { headers: { 'x-admin-pin': pin } }).then(r => r.json());
                const createdBranch = branchList.data?.find((b: any) => b.slug === slug);
                if (createdBranch) await fetch(`/api/admin/branches/${createdBranch._id}`, { method: 'DELETE', headers: { 'x-admin-pin': pin } });
                throw new Error(setupData.error);
            }

            setName(''); setSlug(''); setAdminName(''); setAdminEmail(''); setAdminPassword(''); setShowManualAdd(false);
            loadDataForTab('aktif');
            alert(`Cabang "${name}" berhasil dibuat!`);
        } catch (err: any) {
            alert(`GAGAL: ${err.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full border border-slate-100">
                    <h1 className="text-2xl font-bold mb-6 text-center text-slate-800">Admin Login</h1>
                    <form onSubmit={handleLogin}>
                        <div className="mb-4">
                            <label className="block text-slate-700 text-sm font-semibold mb-2">PIN Keamanan</label>
                            <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-slate-800" placeholder="Masukkan PIN" required />
                        </div>
                        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
                        <button type="submit" disabled={loading} className="w-full bg-slate-800 text-white font-bold py-3 px-4 rounded-xl hover:bg-slate-900 disabled:opacity-50 transition-colors">
                            {loading ? 'Memeriksa...' : 'Masuk Dashboard'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-8 gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Master Admin Panel</h1>
                        <p className="text-slate-500 text-sm">Kelola pendaftaran, cabang, dan konfigurasi master.</p>
                    </div>
                    <button onClick={() => { sessionStorage.removeItem('admin_pin'); document.cookie = 'admin_pin=; Max-Age=0; path=/;'; setIsAuthenticated(false); setPin(''); }} className="text-red-600 hover:text-red-800 font-semibold bg-red-50 px-4 py-2 rounded-lg transition-colors w-fit">
                        Keluar
                    </button>
                </div>

                <div className="flex space-x-1 mb-6 bg-slate-200/50 p-1 rounded-xl w-fit">
                    <button onClick={() => setActiveTab('pending')} className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'pending' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                        Pendaftaran Baru {registrations.length > 0 && <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{registrations.length}</span>}
                    </button>
                    <button onClick={() => setActiveTab('aktif')} className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'aktif' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                        Cabang Aktif
                    </button>
                    <button onClick={() => setActiveTab('settings')} className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'settings' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                        Pengaturan
                    </button>
                </div>

                {loading && !isSubmitting && <p className="text-slate-500 py-4">Memuat data...</p>}

                {/* TAB PENDING */}
                {!loading && activeTab === 'pending' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-6 border-b border-slate-100">
                            <h2 className="text-lg font-bold text-slate-800">Menunggu Persetujuan</h2>
                            <p className="text-sm text-slate-500 mt-1">Daftar toko baru yang didaftarkan lewat landing page.</p>
                        </div>
                        {registrations.length === 0 ? (
                            <div className="p-12 text-center text-slate-500">Tidak ada pendaftaran baru.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Detail Toko</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Kontak Owner</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Waktu Daftar</th>
                                            <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-slate-100">
                                        {registrations.map(reg => (
                                            <tr key={reg._id} className="hover:bg-slate-50">
                                                <td className="px-6 py-4">
                                                    <div className="font-semibold text-slate-900">{reg.storeName}</div>
                                                    <div className="text-sm text-blue-600">/{reg.slug}</div>
                                                </td>
                                                <td className="px-6 py-4 text-sm">
                                                    <div className="font-medium text-slate-800">{reg.ownerName}</div>
                                                    <div className="text-slate-500">{reg.email}</div>
                                                    <div className="text-slate-500">{reg.phone}</div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-500">
                                                    {new Date(reg.createdAt).toLocaleString('id-ID')}
                                                </td>
                                                <td className="px-6 py-4 text-right space-x-3">
                                                    <button onClick={() => handleApproveRegistration(reg._id, reg.storeName)} disabled={isSubmitting} className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 disabled:opacity-50">
                                                        Setujui
                                                    </button>
                                                    <button onClick={() => handleRejectRegistration(reg._id, reg.storeName)} disabled={isSubmitting} className="inline-flex items-center px-3 py-1.5 border border-slate-300 text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50">
                                                        Tolak
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* TAB AKTIF */}
                {!loading && activeTab === 'aktif' && (
                    <div className="space-y-6">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800">Daftar Cabang Aktif</h2>
                                    <p className="text-sm text-slate-500 mt-1">Tenant yang saat ini beroperasi di sistem.</p>
                                </div>
                                <button onClick={() => setShowManualAdd(!showManualAdd)} className="text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 px-4 py-2 rounded-lg font-medium transition-colors">
                                    {showManualAdd ? 'Tutup Form' : '+ Tambah Manual'}
                                </button>
                            </div>
                            
                            {showManualAdd && (
                                <div className="p-6 bg-slate-50 border-b border-slate-200">
                                    <h3 className="font-bold text-slate-800 mb-4">Tambah Cabang Manual</h3>
                                    <form onSubmit={handleManualAddBranch} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Cabang</label>
                                                <input type="text" required value={name} onChange={(e) => { setName(e.target.value); if(!slug || slug === generateSlug(name)) setSlug(generateSlug(e.target.value)); }} className="w-full px-3 py-2 border rounded-lg" placeholder="Salon XYZ" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">URL Slug</label>
                                                <div className="flex">
                                                    <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 bg-slate-100 text-slate-500 text-sm">/</span>
                                                    <input type="text" required value={slug} onChange={(e) => setSlug(generateSlug(e.target.value))} className="flex-1 min-w-0 block w-full px-3 py-2 border rounded-none rounded-r-lg" placeholder="salon-xyz" />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Admin Name</label>
                                                <input type="text" required value={adminName} onChange={(e) => setAdminName(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="Admin" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Admin Email</label>
                                                <input type="email" required value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="admin@salon.com" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Admin Password</label>
                                                <input type="password" required value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="Password@123" pattern="^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$" />
                                            </div>
                                        </div>
                                        <div className="md:col-span-2">
                                            <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                                                {isSubmitting ? 'Memproses...' : 'Buat Cabang & Admin'}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            {branches.length === 0 ? (
                                <div className="p-12 text-center text-slate-500">Belum ada cabang.</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-slate-200">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Cabang</th>
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                                                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-slate-100">
                                            {branches.map((b) => (
                                                <tr key={b._id} className="hover:bg-slate-50">
                                                    <td className="px-6 py-4">
                                                        <div className="font-semibold text-slate-900">{b.name}</div>
                                                        <div className="text-sm text-slate-500">/{b.slug}</div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2.5 py-1 inline-flex text-xs font-semibold rounded-full ${b.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                            {b.isActive ? 'Aktif' : 'Non-aktif'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-medium space-x-4">
                                                        <a href={`/${b.slug}/login`} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800">Login →</a>
                                                        {b.slug !== 'pusat' && (
                                                            <>
                                                                <button onClick={() => handleToggleStatus(b._id, b.isActive, b.slug)} className={b.isActive ? 'text-orange-500 hover:text-orange-700' : 'text-green-600 hover:text-green-800'}>
                                                                    {b.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                                                                </button>
                                                                <button onClick={() => handleDeleteBranch(b._id, b.name, b.slug)} className="text-red-600 hover:text-red-800">Hapus</button>
                                                            </>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* TAB SETTINGS */}
                {!loading && activeTab === 'settings' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-6 md:p-8 max-w-2xl">
                        <h2 className="text-xl font-bold text-slate-800 mb-2">Pengaturan Master Admin</h2>
                        <p className="text-slate-500 text-sm mb-6 pb-6 border-b border-slate-100">
                            Konfigurasi notifikasi WhatsApp untuk pendaftaran toko baru.
                        </p>
                        
                        <form onSubmit={handleSaveSettings} className="space-y-6">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Token Fonnte Master</label>
                                <input type="text" value={settings.fonnteToken} onChange={(e) => setSettings({...settings, fonnteToken: e.target.value})} className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Masukkan token Fonnte" />
                                <p className="text-xs text-slate-500 mt-2">Digunakan khusus untuk kirim notifikasi approval. (Bukan untuk blast promosi salon)</p>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Nomor WA Admin Penerima Notifikasi</label>
                                <input type="tel" value={settings.adminPhone} onChange={(e) => setSettings({...settings, adminPhone: e.target.value.replace(/\D/g, '')})} className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder="08123456789" />
                                <p className="text-xs text-slate-500 mt-2">Nomor ini akan di-WA oleh Fonnte setiap ada toko baru yang daftar.</p>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Nama Admin (Pengirim WA)</label>
                                <input type="text" value={settings.adminName} onChange={(e) => setSettings({...settings, adminName: e.target.value})} className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Contoh: Admin Pusat Fukomo" />
                            </div>

                            <div className="pt-4 border-t border-slate-100">
                                <button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white font-medium px-6 py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors w-full sm:w-auto">
                                    {isSubmitting ? 'Menyimpan...' : 'Simpan Pengaturan'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}
