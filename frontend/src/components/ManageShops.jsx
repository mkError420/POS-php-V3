import React, { useState, useEffect, useCallback } from 'react';

const API_BASE_URL = 'http://localhost:5000/api';

// ─── Small helper components ────────────────────────────────────────────────

const StatusBadge = ({ status }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${status === 'active'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : 'bg-rose-50 text-rose-600 border-rose-200'
    }`}>
    <span className={`w-1.5 h-1.5 rounded-full ${status === 'active' ? 'bg-emerald-500' : 'bg-rose-400'}`} />
    {status === 'active' ? 'Active' : 'Suspended'}
  </span>
);

const RoleBadge = ({ role }) => {
  const map = {
    shop_admin: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    shop_staff: 'bg-amber-50 text-amber-700 border-amber-200',
    super_admin: 'bg-rose-50 text-rose-700 border-rose-200',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${map[role] || 'bg-slate-50 text-slate-500 border-slate-200'}`}>
      {role.replace('_', ' ')}
    </span>
  );
};

const FormField = ({ label, required, children }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
      {label}{required && <span className="text-rose-400 ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

const inputCls = "w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-slate-400";

// ─── Toast ───────────────────────────────────────────────────────────────────
function Toast({ alert, onDismiss }) {
  if (!alert) return null;
  return (
    <div className={`fixed top-5 right-5 z-[200] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-white text-sm font-semibold ${alert.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
      }`}>
      {alert.type === 'success' ? (
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )}
      <span className="max-w-xs">{alert.message}</span>
      <button onClick={onDismiss} className="ml-2 opacity-70 hover:opacity-100">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ─── Password strength bar ────────────────────────────────────────────────────
function PasswordStrength({ password }) {
  if (!password) return null;
  const strength = password.length < 6 ? 1 : password.length < 8 ? 2 : /[A-Z]/.test(password) && /[0-9]/.test(password) ? 4 : 3;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['', 'bg-rose-400', 'bg-amber-400', 'bg-lime-400', 'bg-emerald-500'];
  const textColors = ['', 'text-rose-500', 'text-amber-500', 'text-lime-600', 'text-emerald-600'];
  return (
    <div className="mt-1.5">
      <div className="flex gap-1 mb-1">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= strength ? colors[strength] : 'bg-slate-200'}`} />
        ))}
      </div>
      <p className={`text-[10px] font-semibold ${textColors[strength]}`}>{labels[strength]}</p>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function ManageShops() {
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Shop modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedShop, setSelectedShop] = useState(null);
  const [detailShop, setDetailShop] = useState(null);

  // Users modal state
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [usersShop, setUsersShop] = useState(null);
  const [shopUsers, setShopUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // Reset password modal
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetTarget, setResetTarget] = useState(null); // { shopId, user }
  const [newPassword, setNewPassword] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  // Add form
  const emptyAdd = { shop_name: '', shop_email: '', shop_phone: '', shop_address: '', admin_name: '', admin_email: '', admin_password: '' };
  const [addForm, setAddForm] = useState(emptyAdd);
  // Edit form
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', address: '' });
  // Delete confirm text
  const [deleteConfirm, setDeleteConfirm] = useState('');

  const token = () => localStorage.getItem('token');

  const triggerAlert = useCallback((type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  }, []);

  // ── Fetch all shops ────────────────────────────────────────────────────────
  const fetchShops = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/shops`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      if (!res.ok) throw new Error('Failed to retrieve shops.');
      setShops(await res.json());
    } catch (err) {
      triggerAlert('error', err.message);
    } finally {
      setLoading(false);
    }
  }, [triggerAlert]);

  useEffect(() => { fetchShops(); }, [fetchShops]);

  // ── Fetch users for a specific shop ───────────────────────────────────────
  const fetchShopUsers = async (shopId) => {
    setUsersLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/shops/${shopId}/users`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      if (!res.ok) throw new Error('Failed to retrieve users.');
      setShopUsers(await res.json());
    } catch (err) {
      triggerAlert('error', err.message);
    } finally {
      setUsersLoading(false);
    }
  };

  // ── Filtered shops ─────────────────────────────────────────────────────────
  const filtered = shops.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || s.status === filterStatus;
    return matchSearch && matchStatus;
  });

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalShops = shops.length;
  const activeShops = shops.filter(s => s.status === 'active').length;
  const suspendedShops = shops.filter(s => s.status === 'inactive').length;
  const totalUsers = shops.reduce((sum, s) => sum + (s.user_count || 0), 0);

  // ══ SHOP CRUD ══════════════════════════════════════════════════════════════

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/register-shop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify(addForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to register shop.');
      triggerAlert('success', 'Tenant shop and admin registered successfully!');
      setShowAddModal(false);
      setAddForm(emptyAdd);
      fetchShops();
    } catch (err) {
      triggerAlert('error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openDetails = (shop) => setDetailShop(detailShop?.id === shop.id ? null : shop);

  const openEdit = (shop) => {
    setSelectedShop(shop);
    setEditForm({ name: shop.name, email: shop.email, phone: shop.phone || '', address: shop.address || '' });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/shops/${selectedShop.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify(editForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update shop.');
      triggerAlert('success', 'Shop details updated successfully!');
      setShowEditModal(false);
      fetchShops();
      if (detailShop?.id === selectedShop.id) setDetailShop(prev => ({ ...prev, ...editForm }));
    } catch (err) {
      triggerAlert('error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (shop) => {
    const next = shop.status === 'active' ? 'inactive' : 'active';
    try {
      const res = await fetch(`${API_BASE_URL}/shops/${shop.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ status: next })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to toggle status.');
      triggerAlert('success', `Shop ${next === 'active' ? 'activated' : 'suspended'}!`);
      fetchShops();
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  const openDelete = (shop) => { setSelectedShop(shop); setDeleteConfirm(''); setShowDeleteModal(true); };

  const handleDelete = async () => {
    if (deleteConfirm !== selectedShop.name) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/shops/${selectedShop.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete shop.');
      triggerAlert('success', data.message);
      setShowDeleteModal(false);
      if (detailShop?.id === selectedShop.id) setDetailShop(null);
      fetchShops();
    } catch (err) {
      triggerAlert('error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ══ USER MANAGEMENT ════════════════════════════════════════════════════════

  const openUsersModal = (shop) => {
    setUsersShop(shop);
    setShopUsers([]);
    setShowUsersModal(true);
    fetchShopUsers(shop.id);
  };

  const toggleUserStatus = async (user) => {
    const next = user.status === 'active' ? 'inactive' : 'active';
    try {
      const res = await fetch(`${API_BASE_URL}/shops/${usersShop.id}/users/${user.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ status: next })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user status.');
      triggerAlert('success', data.message);
      // Update local state without re-fetching
      setShopUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: next } : u));
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  const openResetPassword = (shop, user) => {
    setResetTarget({ shop, user });
    setNewPassword('');
    setConfirmPassword('');
    setShowNewPw(false);
    setShowConfirmPw(false);
    setShowResetModal(true);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      triggerAlert('error', 'Passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      triggerAlert('error', 'Password must be at least 6 characters.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/shops/${resetTarget.shop.id}/users/${resetTarget.user.id}/reset-password`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
          body: JSON.stringify({ new_password: newPassword })
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset password.');
      triggerAlert('success', data.message);
      setShowResetModal(false);
    } catch (err) {
      triggerAlert('error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <Toast alert={alert} onDismiss={() => setAlert(null)} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Manage Tenant Shops</h2>
          <p className="text-sm text-slate-500 mt-0.5">Super Admin · Global control panel for all tenant shops</p>
        </div>
        <button
          onClick={() => { setAddForm(emptyAdd); setShowAddModal(true); }}
          className="inline-flex items-center gap-2 bg-slate-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-5 rounded-xl text-sm shadow-lg shadow-indigo-600/25 transition-all hover:-translate-y-0.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Register New Shop
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Shops', value: totalShops, icon: '🏪' },
          { label: 'Active Shops', value: activeShops, icon: '✅' },
          { label: 'Suspended', value: suspendedShops, icon: '🚫' },
          { label: 'Total Users', value: totalUsers, icon: '👥' },
        ].map(card => (
          <div key={card.label} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <div className="text-2xl mb-2">{card.icon}</div>
            <div className="text-2xl font-bold text-slate-800">{card.value}</div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" placeholder="Search by shop name or email…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer">
          <option value="all">All Statuses</option>
          <option value="active">Active Only</option>
          <option value="inactive">Suspended Only</option>
        </select>
        <button onClick={fetchShops}
          className="inline-flex items-center gap-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Table + Detail Panel */}
      <div className="flex gap-4">
        {/* Table */}
        <div className={`bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden ${detailShop ? 'flex-1 min-w-0' : 'w-full'}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50">
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Shop Name</th>
                  <th className="px-4 py-3 hidden md:table-cell">Email</th>
                  <th className="px-4 py-3 hidden lg:table-cell">Phone</th>
                  <th className="px-4 py-3 text-center">Users</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {loading ? (
                  <tr><td colSpan="7" className="p-12 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600" />
                      <span className="text-sm">Loading shops…</span>
                    </div>
                  </td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan="7" className="p-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <p className="font-medium">{search || filterStatus !== 'all' ? 'No shops match your filter.' : 'No shops registered yet.'}</p>
                    </div>
                  </td></tr>
                ) : (
                  filtered.map(shop => {
                    const isActive = detailShop?.id === shop.id;
                    return (
                      <tr key={shop.id} onClick={() => openDetails(shop)}
                        className={`transition-colors cursor-pointer ${isActive ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}>
                        <td className="px-4 py-3.5 font-mono text-xs font-bold text-slate-400">#{shop.id}</td>
                        <td className="px-4 py-3.5 font-semibold text-slate-800">{shop.name}</td>
                        <td className="px-4 py-3.5 text-slate-500 font-mono text-xs hidden md:table-cell">{shop.email}</td>
                        <td className="px-4 py-3.5 text-slate-500 hidden lg:table-cell">{shop.phone || <span className="text-slate-300">—</span>}</td>
                        <td className="px-4 py-3.5 text-center">
                          <button onClick={e => { e.stopPropagation(); openUsersModal(shop); }}
                            className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-semibold text-xs bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-lg transition-colors">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                            {shop.user_count}
                          </button>
                        </td>
                        <td className="px-4 py-3.5 text-center"><StatusBadge status={shop.status} /></td>
                        <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            {/* Manage Users */}
                            <button onClick={() => openUsersModal(shop)} title="Manage users & reset passwords"
                              className="p-2 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                              </svg>
                            </button>
                            {/* Edit */}
                            <button onClick={() => openEdit(shop)} title="Edit shop"
                              className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            {/* Toggle Status */}
                            <button onClick={() => toggleStatus(shop)} title={shop.status === 'active' ? 'Suspend' : 'Activate'}
                              className={`p-2 rounded-lg transition-colors ${shop.status === 'active' ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'}`}>
                              {shop.status === 'active' ? (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              )}
                            </button>
                            {/* Delete */}
                            <button onClick={() => openDelete(shop)} title="Delete shop"
                              className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {!loading && (
            <div className="px-4 py-2.5 border-t border-slate-100 text-xs text-slate-400 flex justify-between">
              <span>Showing {filtered.length} of {totalShops} shops</span>
              {(search || filterStatus !== 'all') && (
                <button onClick={() => { setSearch(''); setFilterStatus('all'); }} className="text-indigo-500 hover:text-indigo-700 font-semibold">
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Detail Side Panel */}
        {detailShop && (
          <div className="w-72 shrink-0 bg-white border border-slate-200 rounded-2xl shadow-xs p-5 space-y-4 self-start sticky top-0">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm">Shop Details</h3>
              <button onClick={() => setDetailShop(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-xl font-bold text-indigo-600 shrink-0">
                {detailShop.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-slate-800 truncate">{detailShop.name}</p>
                <StatusBadge status={detailShop.status} />
              </div>
            </div>
            <div className="space-y-3 text-sm">
              {[
                { label: 'Shop ID', value: `#${detailShop.id}` },
                { label: 'Email', value: detailShop.email },
                { label: 'Phone', value: detailShop.phone || '—' },
                { label: 'Address', value: detailShop.address || '—' },
                { label: 'Total Users', value: `${detailShop.user_count} user(s)` },
                { label: 'Registered', value: new Date(detailShop.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) },
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
                  <span className="text-slate-700 font-medium break-all">{value}</span>
                </div>
              ))}
            </div>
            <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
              <button onClick={() => openUsersModal(detailShop)}
                className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold py-2 rounded-xl transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                Manage Users & Passwords
              </button>
              <button onClick={() => openEdit(detailShop)}
                className="w-full flex items-center justify-center gap-2 bg-slate-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2 rounded-xl transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Shop
              </button>
              <button onClick={() => toggleStatus(detailShop)}
                className={`w-full flex items-center justify-center gap-2 text-sm font-semibold py-2 rounded-xl border transition-colors ${detailShop.status === 'active' ? 'border-amber-200 text-amber-700 hover:bg-amber-50' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                  }`}>
                {detailShop.status === 'active' ? '⏸ Suspend Shop' : '▶ Activate Shop'}
              </button>
              <button onClick={() => openDelete(detailShop)}
                className="w-full flex items-center justify-center gap-2 border border-rose-200 text-rose-600 hover:bg-rose-50 text-sm font-semibold py-2 rounded-xl transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete Shop
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          MODAL: Register New Shop
      ══════════════════════════════════════════════════════════════ */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[92vh]">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Register New Tenant Shop</h3>
                <p className="text-xs text-slate-400 mt-0.5">Creates the shop and its first administrator account</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="overflow-y-auto flex-1">
              <div className="px-6 py-5 space-y-5">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-6 h-6 rounded-full bg-slate-600 text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
                    <h4 className="text-sm font-bold text-slate-700">Shop Profile</h4>
                  </div>
                  <div className="space-y-3 pl-8">
                    <FormField label="Shop Name" required>
                      <input className={inputCls} type="text" value={addForm.shop_name} onChange={e => setAddForm({ ...addForm, shop_name: e.target.value })} required placeholder="e.g. Uptown Apparel" />
                    </FormField>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="Shop Email" required>
                        <input className={inputCls} type="email" value={addForm.shop_email} onChange={e => setAddForm({ ...addForm, shop_email: e.target.value })} required placeholder="contact@shop.com" />
                      </FormField>
                      <FormField label="Phone">
                        <input className={inputCls} type="text" value={addForm.shop_phone} onChange={e => setAddForm({ ...addForm, shop_phone: e.target.value })} placeholder="555-0100" />
                      </FormField>
                    </div>
                    <FormField label="Address">
                      <input className={inputCls} type="text" value={addForm.shop_address} onChange={e => setAddForm({ ...addForm, shop_address: e.target.value })} placeholder="123 Main St, City" />
                    </FormField>
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-6 h-6 rounded-full bg-slate-600 text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
                    <h4 className="text-sm font-bold text-slate-700">Shop Administrator Account</h4>
                  </div>
                  <div className="space-y-3 pl-8">
                    <FormField label="Admin Full Name" required>
                      <input className={inputCls} type="text" value={addForm.admin_name} onChange={e => setAddForm({ ...addForm, admin_name: e.target.value })} required placeholder="e.g. James Smith" />
                    </FormField>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="Admin Login Email" required>
                        <input className={inputCls} type="email" value={addForm.admin_email} onChange={e => setAddForm({ ...addForm, admin_email: e.target.value })} required placeholder="admin@shop.com" />
                      </FormField>
                      <FormField label="Password" required>
                        <input className={inputCls} type="password" value={addForm.admin_password} onChange={e => setAddForm({ ...addForm, admin_password: e.target.value })} required placeholder="••••••••" />
                      </FormField>
                    </div>
                  </div>
                </div>
              </div>
            </form>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 shrink-0">
              <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={handleAddSubmit} disabled={submitting} className="px-5 py-2 bg-slate-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors shadow flex items-center gap-2">
                {submitting && <span className="animate-spin w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" />}
                Register Shop & Admin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL: Edit Shop
      ══════════════════════════════════════════════════════════════ */}
      {showEditModal && selectedShop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Edit Shop</h3>
                <p className="text-xs text-slate-400 mt-0.5">#{selectedShop.id} · {selectedShop.name}</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="px-6 py-5 space-y-4">
                <FormField label="Shop Name" required>
                  <input className={inputCls} type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required />
                </FormField>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Email" required>
                    <input className={inputCls} type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} required />
                  </FormField>
                  <FormField label="Phone">
                    <input className={inputCls} type="text" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
                  </FormField>
                </div>
                <FormField label="Address">
                  <input className={inputCls} type="text" value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} />
                </FormField>
              </div>
              <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
                <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">Cancel</button>
                <button type="submit" disabled={submitting} className="px-5 py-2 bg-slate-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors shadow flex items-center gap-2">
                  {submitting && <span className="animate-spin w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL: Delete Confirm
      ══════════════════════════════════════════════════════════════ */}
      {showDeleteModal && selectedShop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="p-6">
              <div className="w-14 h-14 rounded-2xl bg-rose-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-800 text-center mb-1">Delete Shop Permanently?</h3>
              <p className="text-sm text-slate-500 text-center mb-5">
                This will permanently remove <strong className="text-slate-800">{selectedShop.name}</strong>. This action <span className="text-rose-600 font-bold">cannot be undone</span>.
              </p>
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 mb-5 text-xs text-rose-700 space-y-1">
                <p>⚠️ All products, sales, customers, staff and suppliers will be deleted.</p>
                <p>⚠️ Shops with active users cannot be deleted — suspend users first.</p>
              </div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Type shop name to confirm: <span className="text-rose-600 font-bold">{selectedShop.name}</span>
              </label>
              <input type="text" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder={selectedShop.name}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-rose-400 focus:border-transparent" />
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={handleDelete} disabled={deleteConfirm !== selectedShop.name || submitting}
                className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                {submitting && <span className="animate-spin w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" />}
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL: Manage Users + Reset Passwords
      ══════════════════════════════════════════════════════════════ */}
      {showUsersModal && usersShop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[88vh]">
            {/* Header */}
            <div className="flex justify-between items-start px-6 py-4 border-b border-slate-100 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center text-violet-600 font-bold text-sm shrink-0">
                    {usersShop.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">{usersShop.name}</h3>
                    <p className="text-xs text-slate-400">Manage users & reset passwords</p>
                  </div>
                </div>
              </div>
              <button onClick={() => setShowUsersModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors mt-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Info banner */}
            <div className="mx-6 mt-4 mb-2 bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 text-xs text-violet-700 flex items-start gap-2 shrink-0">
              <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>As Super Admin, you can view all users, reset their passwords, and suspend/activate their accounts without logging into the tenant.</span>
            </div>

            {/* Users List */}
            <div className="flex-1 overflow-y-auto px-6 pb-2">
              {usersLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-violet-600" />
                  <span className="text-sm">Loading users…</span>
                </div>
              ) : shopUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <p className="font-medium">No users found for this shop.</p>
                </div>
              ) : (
                <div className="space-y-2 py-2">
                  {shopUsers.map(user => (
                    <div key={user.id}
                      className="flex items-center gap-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 transition-colors">
                      {/* Avatar */}
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${user.role === 'shop_admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                        {user.name.charAt(0).toUpperCase()}
                      </div>

                      {/* User info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-slate-800 text-sm">{user.name}</p>
                          <RoleBadge role={user.role} />
                          <StatusBadge status={user.status} />
                        </div>
                        <p className="text-xs text-slate-500 font-mono mt-0.5 truncate">{user.email}</p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Reset Password */}
                        <button
                          onClick={() => openResetPassword(usersShop, user)}
                          title="Reset password"
                          className="inline-flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                          </svg>
                          Reset Password
                        </button>
                        {/* Toggle Status */}
                        <button
                          onClick={() => toggleUserStatus(user)}
                          title={user.status === 'active' ? 'Suspend user' : 'Activate user'}
                          className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${user.status === 'active'
                            ? 'border-amber-300 text-amber-700 hover:bg-amber-50'
                            : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                            }`}
                        >
                          {user.status === 'active' ? (
                            <>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Suspend
                            </>
                          ) : (
                            <>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Activate
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 shrink-0 flex justify-between items-center">
              <span className="text-xs text-slate-400">{shopUsers.length} user(s) in this tenant</span>
              <button onClick={() => setShowUsersModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL: Reset Password
      ══════════════════════════════════════════════════════════════ */}
      {showResetModal && resetTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-sm shrink-0">
                    {resetTarget.user.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800">Reset Password</h3>
                    <p className="text-xs text-slate-400">{resetTarget.user.name} · {resetTarget.shop.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <RoleBadge role={resetTarget.user.role} />
                  <span className="text-xs font-mono text-slate-400">{resetTarget.user.email}</span>
                </div>
              </div>
              <button onClick={() => setShowResetModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors mt-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Warning banner */}
            <div className="mx-6 mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700 flex items-start gap-2">
              <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>The user's current password will be immediately replaced. They will need to use the new password to log in.</span>
            </div>

            {/* Form */}
            <form onSubmit={handleResetPassword}>
              <div className="px-6 py-5 space-y-4">
                {/* New Password */}
                <FormField label="New Password" required>
                  <div className="relative">
                    <input
                      type={showNewPw ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      required
                      minLength={6}
                      placeholder="Enter new password (min. 6 chars)"
                      className={`${inputCls} pr-10`}
                    />
                    <button type="button" onClick={() => setShowNewPw(!showNewPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showNewPw ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <PasswordStrength password={newPassword} />
                </FormField>

                {/* Confirm Password */}
                <FormField label="Confirm New Password" required>
                  <div className="relative">
                    <input
                      type={showConfirmPw ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      required
                      placeholder="Re-enter new password"
                      className={`${inputCls} pr-10 ${confirmPassword && confirmPassword !== newPassword ? 'border-rose-300 ring-1 ring-rose-300' : confirmPassword && confirmPassword === newPassword ? 'border-emerald-300 ring-1 ring-emerald-300' : ''}`}
                    />
                    <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showConfirmPw ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {confirmPassword && (
                    <p className={`text-[10px] font-semibold mt-1 ${confirmPassword === newPassword ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {confirmPassword === newPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                    </p>
                  )}
                </FormField>
              </div>

              <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end">
                <button type="button" onClick={() => setShowResetModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !newPassword || newPassword !== confirmPassword || newPassword.length < 6}
                  className="px-5 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-colors shadow flex items-center gap-2"
                >
                  {submitting && <span className="animate-spin w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" />}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  Reset Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
