import React, { useState, useEffect } from 'react';
import API_BASE_URL from '../config';

export default function ShopBackups() {
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [backupLoading, setBackupLoading] = useState({});

  const token = () => localStorage.getItem('token');

  const fetchShops = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/shops`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      if (res.ok) {
        setShops(await res.json());
      }
    } catch (err) {
      console.error('Failed to retrieve tenant shops:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShops();
  }, []);

  const handleDownloadBackup = async (shop) => {
    setBackupLoading(prev => ({ ...prev, [shop.id]: true }));
    try {
      const res = await fetch(`${API_BASE_URL}/superadmin/backup/shop/${shop.id}`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      
      if (!res.ok) {
        throw new Error('Failed to generate shop database backup.');
      }
      
      const disposition = res.headers.get('content-disposition');
      let filename = `backup_shop_${shop.id}_${shop.name.replace(/[^a-zA-Z0-9_\-]/g, '_')}.sql`;
      if (disposition && disposition.indexOf('attachment') !== -1) {
        const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
        const matches = filenameRegex.exec(disposition);
        if (matches != null && matches[1]) { 
          filename = matches[1].replace(/['"]/g, '');
        }
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message);
    } finally {
      setBackupLoading(prev => ({ ...prev, [shop.id]: false }));
    }
  };

  const filteredShops = shops.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Shop Database Backups</h2>
        <p className="text-sm text-slate-500 mt-0.5">Export and generate standard SQL database dumps for individual tenant storefronts.</p>
      </div>

      {/* Info Card */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-2xl p-6 text-white border border-indigo-500/20 relative overflow-hidden shadow-lg">
        <div className="absolute top-[-50%] right-[-20%] w-80 h-80 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <h3 className="font-bold text-base text-indigo-400">Tenant Data Isolation Backup</h3>
        <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
          This panel allows you to generate isolated SQL scripts containing structure-compatible insert statements for each tenant.
          The backup contains the shop profile, administrator and staff users, products catalog, customers, suppliers, sale transactions, waste logs, and other financials. All storefront assets (like base64 store logos and proof invoices) are fully embedded inside the database file.
        </p>
        <div className="mt-4 flex items-center gap-2 text-xs bg-white/10 w-fit px-3 py-1.5 rounded-lg border border-white/10 font-mono">
          <span>Restore Guide:</span>
          <span className="text-slate-200">mysql -u [username] -p [database_name] &lt; backup_file.sql</span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tenant shop by name or email..."
            className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-805 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-xs"
          />
        </div>
      </div>

      {/* Shops Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-600 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Shop ID</th>
                <th className="px-6 py-4">Shop Name</th>
                <th className="px-6 py-4">Admin Email</th>
                <th className="px-6 py-4">Plan Package</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Database Dump</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="6" className="p-12 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-650" />
                      <span>Loading shops...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredShops.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-slate-455">
                    No registered shops match your search term.
                  </td>
                </tr>
              ) : (
                filteredShops.map((shop) => (
                  <tr key={shop.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs font-bold text-slate-400">#{shop.id}</td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800">{shop.name}</div>
                      <div className="text-xs text-slate-400 truncate max-w-xs">{shop.address || 'No address provided'}</div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-550">{shop.email}</td>
                    <td className="px-6 py-4">
                      {shop.package_name ? (
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded uppercase">
                            {shop.package_name}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {shop.subscription_status.toUpperCase()}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">No Active Plan</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        shop.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-150'
                          : 'bg-rose-50 text-rose-600 border-rose-150'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${shop.status === 'active' ? 'bg-emerald-500' : 'bg-rose-400'}`} />
                        {shop.status === 'active' ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDownloadBackup(shop)}
                        disabled={backupLoading[shop.id]}
                        className="inline-flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-2 px-3.5 rounded-xl text-xs shadow-md shadow-indigo-600/10 active:translate-y-0.5 transition-all"
                      >
                        {backupLoading[shop.id] ? (
                          <>
                            <svg className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full shrink-0" viewBox="0 0 24 24" />
                            <span>Exporting...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            <span>Download SQL</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
