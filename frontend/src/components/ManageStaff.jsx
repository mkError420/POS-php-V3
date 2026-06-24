import React, { useState, useEffect } from 'react';

const API_BASE_URL = 'http://localhost:5000/api';

const SECTION_OPTIONS = [
  { label: 'POS Checkout', path: '/checkout' },
  { label: 'Held Bills', path: '/held-bills' },
  { label: 'Sales History', path: '/sales' },
  { label: 'Manual Orders Entry', path: '/manual-orders' },
  { label: 'Inventory Catalog', path: '/products' },
  { label: 'Wastage Logs', path: '/wastage' },
  { label: 'Suppliers Directory', path: '/suppliers' },
  { label: 'Customer Directory', path: '/customers' },
  { label: 'Other Costs', path: '/other-cost' },
  { label: 'Total Revenue', path: '/total-revenue' },
  { label: 'Manage Staff', path: '/staff' },
  { label: 'Settings', path: '/settings' }
];

export default function ManageStaff() {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [alert, setAlert] = useState(null);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentStaff, setCurrentStaff] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'shop_staff',
    status: 'active',
    allowed_sections: []
  });

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/users/staff`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to retrieve staff catalog.');
      const data = await response.json();
      setStaffList(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const triggerAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 4000);
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.password) {
      triggerAlert('error', 'Please fill in all fields.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/users/staff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role,
          allowed_sections: formData.allowed_sections
        })
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to register staff.');

      triggerAlert('success', 'Staff account created successfully!');
      setShowAddModal(false);
      resetForm();
      fetchStaff();
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  const openEdit = (staff) => {
    setCurrentStaff(staff);
    setFormData({
      name: staff.name,
      email: staff.email,
      role: staff.role,
      status: staff.status,
      password: '', // Don't preload hash password
      allowed_sections: staff.allowed_sections || []
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const payload = {
        name: formData.name,
        role: formData.role,
        status: formData.status,
        allowed_sections: formData.allowed_sections
      };
      if (formData.password) {
        payload.password = formData.password;
      }

      const response = await fetch(`${API_BASE_URL}/users/staff/${currentStaff.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to update account.');

      triggerAlert('success', 'Staff account updated successfully!');
      setShowEditModal(false);
      resetForm();
      fetchStaff();
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  const handleDelete = async (staffId) => {
    if (!window.confirm('Are you sure you want to delete this staff user account?')) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/users/staff/${staffId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to delete account.');

      triggerAlert('success', 'Staff user deleted successfully!');
      fetchStaff();
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'shop_staff',
      status: 'active',
      allowed_sections: []
    });
    setCurrentSupplier(null);
  };

  const setCurrentSupplier = (val) => {}; // placeholder

  return (
    <div className="space-y-6">
      
      {alert && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg flex items-center transition-all ${
          alert.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
        }`}>
          <span className="text-sm font-semibold">{alert.message}</span>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Manage Shop Staff</h2>
          <p className="text-sm text-slate-500">Provide POS terminals access permissions, roles, and status keys</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowAddModal(true); }}
          className="bg-slate-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-5 rounded-xl text-sm shadow transition-colors flex items-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>Register New Staff</span>
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                <th className="p-4">Name</th>
                <th className="p-4">Email</th>
                <th className="p-4">Access Role</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="5" className="p-12 text-center">
                    <div className="flex justify-center items-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
                    </div>
                  </td>
                </tr>
              ) : staffList.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-12 text-center text-slate-400">
                    No staff records found. Register cashiers to start.
                  </td>
                </tr>
              ) : (
                staffList.map((staff) => (
                  <tr key={staff.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 font-semibold text-slate-800">{staff.name}</td>
                    <td className="p-4 text-slate-600 font-mono text-xs">{staff.email}</td>
                    <td className="p-4">
                      <div className="flex flex-col space-y-1">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold w-max ${
                          staff.role === 'shop_admin'
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                            : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                        }`}>
                          {staff.role === 'shop_admin' ? 'Shop Admin' : 'Shop Staff'}
                        </span>
                        {staff.role === 'shop_staff' && (
                          <div className="flex flex-wrap gap-1 max-w-xs pt-1">
                            {staff.allowed_sections && staff.allowed_sections.length > 0 ? (
                              staff.allowed_sections.map(path => {
                                const matched = SECTION_OPTIONS.find(o => o.path === path);
                                return (
                                  <span key={path} className="text-[9px] bg-slate-100 text-slate-650 px-1.5 py-0.5 rounded border border-slate-205 font-medium">
                                    {matched ? matched.label : path}
                                  </span>
                                );
                              })
                            ) : (
                              <span className="text-[9px] text-rose-500 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">No Access</span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                        staff.status === 'active'
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}>
                        {staff.status}
                      </span>
                    </td>
                    <td className="p-4 text-center space-x-2">
                      <button
                        onClick={() => openEdit(staff)}
                        className="text-indigo-600 hover:text-indigo-900 font-semibold text-xs border border-indigo-100 hover:bg-indigo-50 px-2.5 py-1 rounded-lg transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(staff.id)}
                        className="text-rose-600 hover:text-rose-900 font-semibold text-xs border border-rose-100 hover:bg-rose-50 px-2.5 py-1 rounded-lg transition-colors"
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

      {/* ADD MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">Register New Staff</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleAddSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Employee Full Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g. Bob Smith"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Email Address *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  placeholder="bob@shop.com"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Initial Password *</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  placeholder="••••••••"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Access Level Role *</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="shop_staff">Shop Staff (Custom Permissions)</option>
                  <option value="shop_admin">Shop Admin (Full catalog control)</option>
                </select>
              </div>

              {formData.role === 'shop_staff' && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Allowed Sections (Access Control) *</label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200/60 max-h-48 overflow-y-auto">
                    {SECTION_OPTIONS.map((sec) => {
                      const isChecked = formData.allowed_sections?.includes(sec.path);
                      return (
                        <label key={sec.path} className="flex items-center space-x-2.5 p-1.5 hover:bg-white rounded-lg cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const updated = e.target.checked
                                ? [...(formData.allowed_sections || []), sec.path]
                                : (formData.allowed_sections || []).filter((p) => p !== sec.path);
                              setFormData({ ...formData, allowed_sections: updated });
                            }}
                            className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                          />
                          <span className="text-xs text-slate-700 font-medium">{sec.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
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
                  className="px-5 py-2 bg-slate-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors shadow"
                >
                  Register Staff
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">Edit Account: {currentStaff?.name}</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Employee Full Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Access Level Role *</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="shop_staff">Shop Staff (Custom Permissions)</option>
                  <option value="shop_admin">Shop Admin (Full catalog control)</option>
                </select>
              </div>

              {formData.role === 'shop_staff' && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Allowed Sections (Access Control) *</label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200/60 max-h-48 overflow-y-auto">
                    {SECTION_OPTIONS.map((sec) => {
                      const isChecked = formData.allowed_sections?.includes(sec.path);
                      return (
                        <label key={sec.path} className="flex items-center space-x-2.5 p-1.5 hover:bg-white rounded-lg cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const updated = e.target.checked
                                ? [...(formData.allowed_sections || []), sec.path]
                                : (formData.allowed_sections || []).filter((p) => p !== sec.path);
                              setFormData({ ...formData, allowed_sections: updated });
                            }}
                            className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                          />
                          <span className="text-xs text-slate-700 font-medium">{sec.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Status Code *</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="active">Active (Access allowed)</option>
                  <option value="inactive">Inactive (Access suspended)</option>
                </select>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Reset Password</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Leave blank to keep current password"
                  className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-white outline-none focus:ring-1 focus:ring-indigo-500"
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
                  className="px-5 py-2 bg-slate-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors shadow"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
