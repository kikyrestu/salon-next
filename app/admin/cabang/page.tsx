'use client';

import React, { useState, useEffect } from 'react';

export default function AdminCabangPage() {
    const [pin, setPin] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [branches, setBranches] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Form state - Branch
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    
    // Form state - Admin
    const [adminName, setAdminName] = useState('');
    const [adminEmail, setAdminEmail] = useState('');
    const [adminPassword, setAdminPassword] = useState('');

    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Check if we have PIN in sessionStorage
    useEffect(() => {
        const savedPin = sessionStorage.getItem('admin_pin');
        if (savedPin) {
            setPin(savedPin);
            fetchBranches(savedPin);
        }
    }, []);

    const fetchBranches = async (currentPin: string) => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/admin/branches', {
                headers: {
                    'x-admin-pin': currentPin
                }
            });
            const data = await res.json();
            
            if (res.ok && data.success) {
                setBranches(data.data);
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

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        fetchBranches(pin);
    };

    const handleAddBranch = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');
        
        try {
            // 1. Create Branch in Master DB
            const res = await fetch('/api/admin/branches', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-pin': pin
                },
                body: JSON.stringify({ name, slug })
            });
            
            const data = await res.json();
            
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Gagal membuat cabang di Master DB');
            }

            // 2. Wait a short moment for DB initialization (if needed)
            await new Promise(resolve => setTimeout(resolve, 500));

            // 3. Setup Super Admin in the new Tenant DB
            const setupRes = await fetch('/api/setup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-store-slug': slug
                },
                body: JSON.stringify({ 
                    name: adminName, 
                    email: adminEmail, 
                    password: adminPassword 
                })
            });

            const setupData = await setupRes.json();

            if (!setupRes.ok || !setupData.success) {
                // Rollback: Hapus cabang dari Master DB kalau gagal setup admin
                const branchList = await fetch('/api/admin/branches', { headers: { 'x-admin-pin': pin } }).then(r => r.json());
                const createdBranch = branchList.data?.find((b: any) => b.slug === slug);
                if (createdBranch) {
                    await fetch(`/api/admin/branches/${createdBranch._id}`, {
                        method: 'DELETE',
                        headers: { 'x-admin-pin': pin }
                    });
                }
                throw new Error(setupData.error || 'Gagal membuat Super Admin di database cabang. Cabang dibatalkan.');
            }

            // Success
            setName('');
            setSlug('');
            setAdminName('');
            setAdminEmail('');
            setAdminPassword('');
            fetchBranches(pin);
            alert(`Cabang "${name}" berhasil dibuat beserta akun Super Admin! Silakan login di /${slug}/login`);

        } catch (err: any) {
            const errorMsg = err.message || 'Terjadi kesalahan jaringan';
            setError(errorMsg);
            alert(`GAGAL: ${errorMsg}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleToggleStatus = async (id: string, currentStatus: boolean, slug: string) => {
        if (slug === 'pusat') {
            alert('Cabang Pusat tidak bisa dinonaktifkan.');
            return;
        }

        try {
            const res = await fetch(`/api/admin/branches/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-pin': pin
                },
                body: JSON.stringify({ isActive: !currentStatus })
            });
            const data = await res.json();
            
            if (res.ok && data.success) {
                fetchBranches(pin);
            } else {
                alert(data.error || 'Gagal mengubah status cabang');
            }
        } catch (err: any) {
            alert('Terjadi kesalahan jaringan');
        }
    };

    const handleDeleteBranch = async (id: string, name: string, slug: string) => {
        if (slug === 'pusat') {
            alert('Cabang Pusat tidak bisa dihapus.');
            return;
        }

        if (!window.confirm(`Yakin ingin menghapus cabang "${name}"? Data asli di database tidak akan terhapus, namun cabang ini tidak akan bisa diakses lagi.`)) {
            return;
        }

        try {
            const res = await fetch(`/api/admin/branches/${id}`, {
                method: 'DELETE',
                headers: {
                    'x-admin-pin': pin
                }
            });
            const data = await res.json();
            
            if (res.ok && data.success) {
                fetchBranches(pin);
                alert(`Cabang "${name}" berhasil dihapus dari sistem.`);
            } else {
                alert(data.error || 'Gagal menghapus cabang');
            }
        } catch (err: any) {
            alert('Terjadi kesalahan jaringan');
        }
    };

    const generateSlug = (val: string) => {
        return val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    };

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="bg-white p-8 rounded-lg shadow-lg max-w-sm w-full">
                    <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">Admin Login</h1>
                    <form onSubmit={handleLogin}>
                        <div className="mb-4">
                            <label className="block text-gray-700 text-sm font-bold mb-2">PIN Keamanan</label>
                            <input 
                                type="password" 
                                value={pin}
                                onChange={(e) => setPin(e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                placeholder="Masukkan PIN"
                                required
                            />
                        </div>
                        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                            {loading ? 'Memeriksa...' : 'Masuk'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-5xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-800">Manajemen Cabang (Tenant)</h1>
                    <button 
                        onClick={() => {
                            sessionStorage.removeItem('admin_pin');
                            document.cookie = 'admin_pin=; Max-Age=0; path=/;';
                            setIsAuthenticated(false);
                            setPin('');
                        }}
                        className="text-red-600 hover:underline font-semibold"
                    >
                        Keluar
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Add Branch Form */}
                    <div className="bg-white p-6 rounded-lg shadow border md:col-span-1 h-fit">
                        <h2 className="text-xl font-bold mb-4 text-gray-800">Tambah Cabang</h2>
                        <form onSubmit={handleAddBranch}>
                            <div className="mb-4">
                                <label className="block text-gray-700 text-sm font-bold mb-2">Nama Cabang</label>
                                <input 
                                    type="text" 
                                    value={name}
                                    onChange={(e) => {
                                        setName(e.target.value);
                                        if (!slug || slug === generateSlug(name)) {
                                            setSlug(generateSlug(e.target.value));
                                        }
                                    }}
                                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                    placeholder="Contoh: Salon Bintaro"
                                    required
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-gray-700 text-sm font-bold mb-2">URL Slug</label>
                                <div className="flex items-center">
                                    <span className="text-gray-500 bg-gray-100 px-3 py-2 border border-r-0 rounded-l-lg text-sm">
                                        /
                                    </span>
                                    <input 
                                        type="text" 
                                        value={slug}
                                        onChange={(e) => setSlug(generateSlug(e.target.value))}
                                        className="w-full px-3 py-2 border rounded-r-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                        placeholder="bintaro"
                                        required
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Akan menjadi URL akses: domain.com/{slug || '...'}</p>
                            </div>

                            <hr className="my-6 border-gray-200" />
                            <h3 className="font-semibold text-gray-800 mb-4">Setup Akun Super Admin</h3>

                            <div className="mb-4">
                                <label className="block text-gray-700 text-sm font-bold mb-2">Nama Admin</label>
                                <input 
                                    type="text" 
                                    value={adminName}
                                    onChange={(e) => setAdminName(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                    placeholder="Contoh: Budi Santoso"
                                    required
                                />
                            </div>
                            
                            <div className="mb-4">
                                <label className="block text-gray-700 text-sm font-bold mb-2">Email Admin</label>
                                <input 
                                    type="email" 
                                    value={adminEmail}
                                    onChange={(e) => setAdminEmail(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                    placeholder="admin@salon.com"
                                    required
                                />
                            </div>

                            <div className="mb-6">
                                <label className="block text-gray-700 text-sm font-bold mb-2">Password Login</label>
                                <input 
                                    type="password" 
                                    value={adminPassword}
                                    onChange={(e) => setAdminPassword(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                    placeholder="Minimal 8 karakter"
                                    pattern="^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$"
                                    title="Password harus mengandung setidaknya satu huruf besar, satu huruf kecil, satu angka, dan satu karakter spesial."
                                    required
                                />
                                <p className="text-xs text-gray-500 mt-1">Harus mengandung huruf besar, kecil, angka & simbol (ex: Admin@123)</p>
                            </div>
                            
                            {error && <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
                                <p className="text-red-700 text-sm">{error}</p>
                            </div>}
                            
                            <button 
                                type="submit" 
                                disabled={isSubmitting}
                                className="w-full bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                            >
                                {isSubmitting ? 'Memproses Setup...' : 'Buat Cabang & Admin'}
                            </button>
                        </form>
                    </div>

                    {/* Branch List */}
                    <div className="bg-white p-6 rounded-lg shadow border md:col-span-2">
                        <h2 className="text-xl font-bold mb-4 text-gray-800">Daftar Cabang Aktif</h2>
                        
                        {loading && !isSubmitting ? (
                            <p className="text-gray-500">Memuat data...</p>
                        ) : branches.length === 0 ? (
                            <p className="text-gray-500 italic">Belum ada cabang.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Cabang</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Slug URL</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {branches.map((b) => (
                                            <tr key={b._id}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{b.name}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">/{b.slug}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${b.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                        {b.isActive ? 'Aktif' : 'Non-aktif'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                    <a href={`/${b.slug}/login`} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-900 mr-4">
                                                        Buka Login →
                                                    </a>
                                                    {b.slug !== 'pusat' && (
                                                        <>
                                                            <button 
                                                                onClick={() => handleToggleStatus(b._id, b.isActive, b.slug)}
                                                                className={`mr-4 hover:underline ${b.isActive ? 'text-orange-500 hover:text-orange-700' : 'text-green-600 hover:text-green-800'}`}
                                                            >
                                                                {b.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                                                            </button>
                                                            <button 
                                                                onClick={() => handleDeleteBranch(b._id, b.name, b.slug)}
                                                                className="text-red-600 hover:text-red-800 hover:underline"
                                                            >
                                                                Hapus
                                                            </button>
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
            </div>
        </div>
    );
}
