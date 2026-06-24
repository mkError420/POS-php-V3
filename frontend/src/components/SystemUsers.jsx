import React, { useState, useEffect, useCallback } from 'react';

const API_BASE_URL = 'http://localhost:5000/api';

// ─── Badges & Helper Components ──────────────────────────────────────────────

const StatusBadge = ({ status }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
    status === 'active'
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
  const labelMap = {
    shop_admin: 'Shop Admin',
    shop_staff: 'Shop Staff',
    super_admin: 'Super Admin',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${map[role] || 'bg-slate-50 text-slate-500 border-slate-200'}`}>
      {labelMap[role] || role.replace('_', ' ')}
    </span>
  );
};

const FormField = ({ label, required, children }) => (
  <div>
    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
      {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

const inputCls = "w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-400";

// ─── Toast alert notification ───────────────────────────────────────────────
function Toast({ alert, onDismiss }) {
  if (!alert) return null;
  return (
    <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg flex items-center transition-all ${
      alert.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
    }`}>
      <span className="text-sm font-semibold">{alert.message}</span>
      <button onClick={onDismiss} className="ml-3 opacity-80 hover:opacity-100 font-bold">×</button>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function SystemUsers() {
  const [users, setUsers] = useState([]);
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState(null);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterShop, setFilterShop] = useState('all');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Form states
  const emptyAddForm = { name: '', email: '', password: '', role: 'shop_staff', shop_id: '' };
  const [addForm, setAddForm] = useState(emptyAddForm);
  const [editForm, setEditForm] = useState({ name: '', email: '', password: '', role: 'shop_staff', status: 'active', shop_id: '' });

  const token = () => localStorage.getItem('token');

  const triggerAlert = useCallback((type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/users`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      if (!res.ok) throw new Error('Failed to retrieve system users.');
      setUsers(await res.json());
    } catch (err) {
      triggerAlert('error', err.message);
    } finally {
      setLoading(false);
    }
  }, [triggerAlert]);

  const fetchShops = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/shops`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      if (res.ok) {
        setShops(await res.json());
      }
    } catch (err) {
      console.error('Error fetching shops:', err);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchShops();
  }, [fetchUsers, fetchShops]);

  const handleInputChange = (e, isEdit = false) => {
    const { name, value } = e.target;
    if (isEdit) {
      setEditForm(prev => ({ ...prev, [name]: value }));
    } else {
      setAddForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!addForm.name || !addForm.email || !addForm.password || !addForm.role) {
      triggerAlert('error', 'Please fill in all required fields.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = { ...addForm };
      if (payload.role === 'super_admin') {
        delete payload.shop_id;
      } else {
        payload.shop_id = parseInt(payload.shop_id) || null;
      }

      const res = await fetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token()}`
        },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user.');

      triggerAlert('success', 'User account created successfully!');
      setShowAddModal(false);
      setAddForm(emptyAddForm);
      fetchUsers();
    } catch (err) {
      triggerAlert('error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setEditForm({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      status: user.status,
      shop_id: user.shop_id || ''
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editForm.name || !editForm.email) {
      triggerAlert('error', 'Name and email are required.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = { ...editForm };
      if (payload.role === 'super_admin') {
        payload.shop_id = null;
      } else {
        payload.shop_id = parseInt(payload.shop_id) || null;
      }
      if (!payload.password) {
        delete payload.password; // Don't send empty password
      }

      const res = await fetch(`${API_BASE_URL}/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token()}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user details.');

      triggerAlert('success', 'User account updated successfully!');
      setShowEditModal(false);
      fetchUsers();
    } catch (err) {
      triggerAlert('error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`Are you sure you want to permanently delete user "${userName}"?`)) return;

    try {
      const res = await fetch(`${API_BASE_URL}/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete user.');

      triggerAlert('success', `User "${userName}" deleted successfully.`);
      fetchUsers();
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  // ─── Filtering Logic ────────────────────────────────────────────────────────
  const filteredUsers = users.filter(user => {
    const matchSearch = user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase());
    
    const matchRole = filterRole === 'all' || user.role === filterRole;
    const matchStatus = filterStatus === 'all' || user.status === filterStatus;
    const matchShop = filterShop === 'all' || 
      (filterShop === 'global' && !user.shop_id) || 
      (user.shop_id && user.shop_id.toString() === filterShop);

    return matchSearch && matchRole && matchStatus && matchShop;
  });

  return (
    <div className="space-y-6">
      <Toast alert={alert} onDismiss={() => setAlert(null)} />

      {/* Header Row */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">System Users</h2>
          <p className="text-sm text-slate-500">Manage administrators, shop managers, and staff accounts globally</p>
        </div>
        <button
          onClick={() => { setAddForm(emptyAddForm); setShowAddModal(true); }}
          className="bg-slate-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-5 rounded-xl text-sm shadow transition-colors flex items-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>Create New User</span>
        </button>
      </div>

      {/* Search and Filters Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[240px]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="w-44">
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Roles</option>
            <option value="super_admin">Super Admin</option>
            <option value="shop_admin">Shop Admin</option>
            <option value="shop_staff">Shop Staff</option>
          </select>
        </div>

        <div className="w-44">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Suspended</option>
          </select>
        </div>

        <div className="w-48">
          <select
            value={filterShop}
            onChange={(e) => setFilterShop(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Shops</option>
            <option value="global">Global (No Shop)</option>
            {shops.map(s => (
              <option key={s.id} value={s.id.toString()}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                <th className="p-4">Name</th>
                <th className="p-4">Email</th>
                <th className="p-4">Role</th>
                <th className="p-4">Associated Shop</th>
                <th className="p-4">Status</th>
                <th className="p-4">Created Date</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="7" className="p-12 text-center">
                    <div className="flex justify-center items-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-12 text-center text-slate-400">
                    No users found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 font-semibold text-slate-800">{user.name}</td>
                    <td className="p-4 text-slate-600 font-mono text-xs">{user.email}</td>
                    <td className="p-4"><RoleBadge role={user.role} /></td>
                    <td className="p-4 text-slate-700">
                      {user.shop_name ? (
                        <span className="font-medium text-slate-800">{user.shop_name}</span>
                      ) : (
                        <span className="text-slate-400 italic font-mono text-xs">Global System</span>
                      )}
                    </td>
                    <td className="p-4"><StatusBadge status={user.status} /></td>
                    <td className="p-4 text-slate-500 font-medium">
                      {new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="p-4 text-center space-x-2">
                      <button
                        onClick={() => openEditModal(user)}
                        className="text-indigo-600 hover:text-indigo-900 font-semibold text-xs border border-indigo-100 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id, user.name)}
                        className="text-rose-600 hover:text-rose-900 font-semibold text-xs border border-rose-100 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          MODAL: Register New User
      ══════════════════════════════════════════════════════════════ */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Register New User</h3>
                <p className="text-xs text-slate-400 mt-0.5">Creates a new administrative or terminal access profile</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <FormField label="Full Name *" required>
                <input
                  type="text"
                  name="name"
                  value={addForm.name}
                  onChange={(e) => handleInputChange(e)}
                  required
                  placeholder="e.g. John Doe"
                  className={inputCls}
                />
              </FormField>

              <FormField label="Email Address *" required>
                <input
                  type="email"
                  name="email"
                  value={addForm.email}
                  onChange={(e) => handleInputChange(e)}
                  required
                  placeholder="john@example.com"
                  className={inputCls}
                />
              </FormField>

              <FormField label="Password *" required>
                <input
                  type="password"
                  name="password"
                  value={addForm.password}
                  onChange={(e) => handleInputChange(e)}
                  required
                  placeholder="•••••••• (Min 6 characters)"
                  className={inputCls}
                />
              </FormField>

              <FormField label="Access level Role *" required>
                <select
                  name="role"
                  value={addForm.role}
                  onChange={(e) => handleInputChange(e)}
                  className={inputCls}
                >
                  <option value="shop_staff">Shop Staff (Checkout only)</option>
                  <option value="shop_admin">Shop Admin (Shop controller)</option>
                  <option value="super_admin">Super Admin (Global access)</option>
                </select>
              </FormField>

              {addForm.role !== 'super_admin' && (
                <FormField label="Assign Tenant Shop *" required>
                  <select
                    name="shop_id"
                    value={addForm.shop_id}
                    onChange={(e) => handleInputChange(e)}
                    required
                    className={inputCls}
                  >
                    <option value="">-- Select Shop --</option>
                    {shops.map(s => (
                      <option key={s.id} value={s.id.toString()}>{s.name}</option>
                    ))}
                  </select>
                </FormField>
              )}

              <div className="pt-4 border-t border-slate-100 flex space-x-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-slate-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-sm font-semibold transition-colors shadow"
                >
                  {submitting ? 'Creating...' : 'Register User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL: Edit User
      ══════════════════════════════════════════════════════════════ */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Edit User Account</h3>
                <p className="text-xs text-slate-400 mt-0.5">Modify permissions, role, shop assignment, or reset password</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <FormField label="Full Name *" required>
                <input
                  type="text"
                  name="name"
                  value={editForm.name}
                  onChange={(e) => handleInputChange(e, true)}
                  required
                  className={inputCls}
                />
              </FormField>

              <FormField label="Email Address *" required>
                <input
                  type="email"
                  name="email"
                  value={editForm.email}
                  onChange={(e) => handleInputChange(e, true)}
                  required
                  className={inputCls}
                />
              </FormField>

              <FormField label="Access level Role *" required>
                <select
                  name="role"
                  value={editForm.role}
                  onChange={(e) => handleInputChange(e, true)}
                  className={inputCls}
                >
                  <option value="shop_staff">Shop Staff (Checkout only)</option>
                  <option value="shop_admin">Shop Admin (Shop controller)</option>
                  <option value="super_admin">Super Admin (Global access)</option>
                </select>
              </FormField>

              {editForm.role !== 'super_admin' && (
                <FormField label="Assign Tenant Shop *" required>
                  <select
                    name="shop_id"
                    value={editForm.shop_id}
                    onChange={(e) => handleInputChange(e, true)}
                    required
                    className={inputCls}
                  >
                    <option value="">-- Select Shop --</option>
                    {shops.map(s => (
                      <option key={s.id} value={s.id.toString()}>{s.name}</option>
                    ))}
                  </select>
                </FormField>
              )}

              <FormField label="Account Status *" required>
                <select
                  name="status"
                  value={editForm.status}
                  onChange={(e) => handleInputChange(e, true)}
                  className={inputCls}
                >
                  <option value="active">Active (Access allowed)</option>
                  <option value="inactive">Suspended (Access blocked)</option>
                </select>
              </FormField>

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 space-y-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Reset Password</label>
                <input
                  type="password"
                  name="password"
                  value={editForm.password}
                  onChange={(e) => handleInputChange(e, true)}
                  placeholder="Leave blank to keep current password"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs bg-white outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex space-x-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-slate-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-sm font-semibold transition-colors shadow"
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
