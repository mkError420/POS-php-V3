import React, { useState, useEffect } from 'react';
import API_BASE_URL from '../config';
import SubscriptionInvoice from './SubscriptionInvoice';

export default function ManagePackages() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [alert, setAlert] = useState(null);

  // Tabs state
  const [activeTab, setActiveTab] = useState('packages'); // 'packages' | 'payment_settings' | 'requests'

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentPackage, setCurrentPackage] = useState(null);

  // Payment settings state
  const [paymentSettings, setPaymentSettings] = useState({
    bkash: '',
    nagad: '',
    bank_name: '',
    bank_account_name: '',
    bank_account_no: '',
    bank_routing: ''
  });
  const [settingsLoading, setSettingsLoading] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    duration_days: 30,
    features: '',
    status: 'active'
  });

  const fetchPackages = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/superadmin/packages`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to retrieve packages catalog.');
      const data = await response.json();
      setPackages(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/superadmin/settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.payment_methods) {
          setPaymentSettings(data.payment_methods);
        }
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  // Pending Requests State
  const [requests, setRequests] = useState([]);
  const [confirmedShops, setConfirmedShops] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceData, setInvoiceData] = useState(null);

  const fetchRequests = async () => {
    setRequestsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/shops`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        const pendingShops = data.filter(s => s.subscription_status === 'pending');
        const approvedShops = data.filter(s => s.subscription_status === 'approved');
        setRequests(pendingShops);
        setConfirmedShops(approvedShops);
      }
    } catch (err) {
      console.error('Failed to load pending requests:', err);
    } finally {
      setRequestsLoading(false);
    }
  };

  const approveSubscription = async (shop) => {
    if (!window.confirm(`Are you sure you want to approve subscription for "${shop.name}"?`)) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/shops/${shop.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          name: shop.name,
          email: shop.email,
          phone: shop.phone || '',
          address: shop.address || '',
          status: 'active',
          subscription_package_id: shop.subscription_package_id,
          subscription_status: 'approved',
          subscription_expires_at: null // Auto calculated by backend
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to approve subscription.');
      triggerAlert('success', 'Subscription approved and shop store activated successfully!');
      fetchRequests();
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  useEffect(() => {
    if (activeTab === 'requests' || activeTab === 'confirmed_shops') {
      fetchRequests();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'payment_settings') {
      fetchSettings();
    }
  }, [activeTab]);

  const triggerAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 4000);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || formData.price === '') {
      triggerAlert('error', 'Please fill in all required fields.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/superadmin/packages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          price: parseFloat(formData.price),
          duration_days: parseInt(formData.duration_days)
        })
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to create subscription package.');

      triggerAlert('success', 'Subscription package created successfully.');
      setShowAddModal(false);
      setFormData({
        name: '',
        price: '',
        duration_days: 30,
        features: '',
        status: 'active'
      });
      fetchPackages();
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  const handleEditClick = (pkg) => {
    setCurrentPackage(pkg);
    setFormData({
      name: pkg.name,
      price: pkg.price,
      duration_days: pkg.duration_days,
      features: pkg.features || '',
      status: pkg.status
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || formData.price === '') {
      triggerAlert('error', 'Please fill in all required fields.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/superadmin/packages/${currentPackage.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          price: parseFloat(formData.price),
          duration_days: parseInt(formData.duration_days)
        })
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to update subscription package.');

      triggerAlert('success', 'Subscription package updated successfully.');
      setShowEditModal(false);
      fetchPackages();
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  const handleDeleteClick = async (pkgId) => {
    if (!window.confirm('Are you sure you want to delete this subscription package?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/superadmin/packages/${pkgId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to delete subscription package.');

      triggerAlert('success', 'Subscription package deleted successfully.');
      fetchPackages();
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSettingsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/superadmin/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          payment_methods: paymentSettings
        })
      });
      if (res.ok) {
        triggerAlert('success', 'Manual payment settings updated successfully.');
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update payment settings.');
      }
    } catch (err) {
      triggerAlert('error', err.message);
    } finally {
      setSettingsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Toast Alert */}
      {alert && (
        <div className={`fixed top-5 right-5 z-[200] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-white text-sm font-semibold transition-all ${
          alert.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
        }`}>
          <span>{alert.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Subscription Settings</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage subscription packages and manual payment options for clients.</p>
        </div>
        {activeTab === 'packages' && (
          <button
            onClick={() => {
              setFormData({ name: '', price: '', duration_days: 30, features: '', status: 'active' });
              setShowAddModal(true);
            }}
            className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/20 active:translate-y-0.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Add New Plan
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('packages')}
          className={`px-5 py-2.5 font-semibold text-sm border-b-2 transition-all ${
            activeTab === 'packages' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Subscription Packages
        </button>
        <button
          onClick={() => setActiveTab('payment_settings')}
          className={`px-5 py-2.5 font-semibold text-sm border-b-2 transition-all ${
            activeTab === 'payment_settings' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Payment Setup (Manual Payments)
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`px-5 py-2.5 font-semibold text-sm border-b-2 transition-all ${
            activeTab === 'requests' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-slate-550 hover:text-slate-700'
          }`}
        >
          Subscription Requests
        </button>
        <button
          onClick={() => setActiveTab('confirmed_shops')}
          className={`px-5 py-2.5 font-semibold text-sm border-b-2 transition-all ${
            activeTab === 'confirmed_shops' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-slate-550 hover:text-slate-700'
          }`}
        >
          Confirmed Shop
        </button>
      </div>

      {/* Plans List Table */}
      {activeTab === 'packages' && (
        loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            <p className="text-slate-500 text-sm">Loading plans...</p>
          </div>
        ) : error ? (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 p-6 rounded-2xl text-center">
            <p className="font-semibold">Error Loading Packages</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        ) : packages.length === 0 ? (
          <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl py-16 text-center">
            <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <h3 className="font-semibold text-slate-700 text-lg">No Subscription Plans Found</h3>
            <p className="text-sm text-slate-500 max-w-xs mx-auto mt-1">Create your first subscription package to enable shop subscription registration.</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-600 text-xs font-bold uppercase tracking-wider">
                    <th className="px-6 py-4">Plan Name</th>
                    <th className="px-6 py-4">Price</th>
                    <th className="px-6 py-4">Duration</th>
                    <th className="px-6 py-4">Included Features</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                  {packages.map((pkg) => (
                    <tr key={pkg.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-800">{pkg.name}</td>
                      <td className="px-6 py-4 font-bold text-slate-900">{pkg.price.toFixed(2)} T.K</td>
                      <td className="px-6 py-4 text-slate-500">{pkg.duration_days} Days</td>
                      <td className="px-6 py-4 text-slate-500 max-w-xs truncate">
                        {pkg.features ? pkg.features : <span className="italic text-slate-400">None</span>}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                          pkg.status === 'active' 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${pkg.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {pkg.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-3">
                        <button
                          onClick={() => handleEditClick(pkg)}
                          className="text-indigo-600 hover:text-indigo-900 font-semibold"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteClick(pkg.id)}
                          className="text-rose-600 hover:text-rose-900 font-semibold"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Manual Payment Settings Configuration Form */}
      {activeTab === 'payment_settings' && (
        <form onSubmit={handleSaveSettings} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-800">Manual Payment Options Configuration</h2>
            <p className="text-slate-500 text-xs mt-0.5">Define the numbers and accounts that clients will use to manually pay for subscriptions during public store signup.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Mobile Banking Section */}
            <div className="space-y-4 border border-slate-100 rounded-xl p-5 bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-700 border-b border-slate-200/60 pb-1.5 flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full" />
                Mobile Banking Channels
              </h3>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">bKash Number</label>
                <input
                  type="text"
                  value={paymentSettings.bkash || ''}
                  onChange={e => setPaymentSettings({ ...paymentSettings, bkash: e.target.value })}
                  placeholder="e.g. 017XXXXXXXX"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Nagad Number</label>
                <input
                  type="text"
                  value={paymentSettings.nagad || ''}
                  onChange={e => setPaymentSettings({ ...paymentSettings, nagad: e.target.value })}
                  placeholder="e.g. 018XXXXXXXX"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>

            {/* Bank Transfer Section */}
            <div className="space-y-4 border border-slate-100 rounded-xl p-5 bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-700 border-b border-slate-200/60 pb-1.5 flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full" />
                Bank Transfer Channel
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Bank Name</label>
                  <input
                    type="text"
                    value={paymentSettings.bank_name || ''}
                    onChange={e => setPaymentSettings({ ...paymentSettings, bank_name: e.target.value })}
                    placeholder="e.g. Dhaka Bank PLC"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Account Name</label>
                  <input
                    type="text"
                    value={paymentSettings.bank_account_name || ''}
                    onChange={e => setPaymentSettings({ ...paymentSettings, bank_account_name: e.target.value })}
                    placeholder="e.g. Codexaa POS Ltd."
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Account Number</label>
                  <input
                    type="text"
                    value={paymentSettings.bank_account_no || ''}
                    onChange={e => setPaymentSettings({ ...paymentSettings, bank_account_no: e.target.value })}
                    placeholder="e.g. 102938475625"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Routing Number</label>
                  <input
                    type="text"
                    value={paymentSettings.bank_routing || ''}
                    onChange={e => setPaymentSettings({ ...paymentSettings, bank_routing: e.target.value })}
                    placeholder="e.g. 12045398"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end border-t border-slate-100 pt-4">
            <button
              type="submit"
              disabled={settingsLoading}
              className="inline-flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-600/50 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/20 active:translate-y-0.5"
            >
              {settingsLoading ? 'Saving Settings...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      )}

      {/* Pending Subscription Requests List */}
      {activeTab === 'requests' && (
        requestsLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            <p className="text-slate-500 text-sm">Loading requests...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl py-16 text-center">
            <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="font-semibold text-slate-700 text-lg">No Pending Requests</h3>
            <p className="text-sm text-slate-500 max-w-xs mx-auto mt-1">All public subscription store signups are currently verified and approved.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-600 text-xs font-bold uppercase tracking-wider">
                      <th className="px-6 py-4">Shop Details</th>
                      <th className="px-6 py-4">Selected Package</th>
                      <th className="px-6 py-4">Manual Payment Info</th>
                      <th className="px-6 py-4">Uploaded Proof Receipt</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                    {requests.map((shop) => (
                      <tr key={shop.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-800 text-sm">{shop.name}</div>
                          <div className="text-xs text-slate-400 font-mono mt-0.5">{shop.email}</div>
                          <div className="text-xs text-slate-500 mt-1">Phone: {shop.phone || 'N/A'}</div>
                          <div className="text-[11px] text-slate-450 italic mt-0.5 truncate max-w-xs">Addr: {shop.address || 'N/A'}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-slate-850 text-xs bg-indigo-50 border border-indigo-100 rounded px-2 py-0.5">
                            {shop.package_name || 'Standard Package'}
                          </span>
                          <div className="text-xs text-slate-600 font-bold mt-2.5">
                            Cost: {shop.price ? `${parseFloat(shop.price).toFixed(2)} T.K` : 'N/A'}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Duration: {shop.duration_days || '30'} Days
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-[10px] uppercase tracking-wider text-slate-700 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">
                            {shop.payment_method ? shop.payment_method.toUpperCase() : 'N/A'}
                          </span>
                          <div className="text-xs text-slate-500 mt-2 font-mono">
                            <span className="text-slate-400">TRX/Ref:</span> {shop.transaction_id || 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {shop.payment_proof ? (
                            <div className="relative group w-24 h-16 border border-slate-200 rounded-lg overflow-hidden bg-slate-50 flex items-center justify-center cursor-pointer"
                              onClick={() => setLightboxImage(shop.payment_proof)}>
                              <img src={shop.payment_proof} alt="Proof Thumbnail" className="max-w-full max-h-full object-cover" />
                              <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] text-white font-semibold">
                                View Proof
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-450 italic">No receipt uploaded</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setInvoiceData({
                                id: shop.id,
                                name: shop.name,
                                email: shop.email,
                                phone: shop.phone,
                                address: shop.address,
                                package_name: shop.package_name,
                                price: shop.price,
                                duration_days: shop.duration_days,
                                payment_method: shop.payment_method,
                                transaction_id: shop.transaction_id,
                                status: 'pending',
                                created_at: shop.created_at
                              });
                              setShowInvoice(true);
                            }}
                            className="bg-indigo-55 bg-indigo-50 hover:bg-indigo-100 text-indigo-750 text-indigo-700 font-bold py-2 px-3.5 rounded-xl text-xs transition-all border border-indigo-100/50"
                          >
                            View Invoice
                          </button>
                          <button
                            onClick={() => approveSubscription(shop)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-xl text-xs shadow-md shadow-emerald-600/10 active:translate-y-0.5 transition-all"
                          >
                            Approve
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      )}

      {/* Confirmed Shop List */}
      {activeTab === 'confirmed_shops' && (
        requestsLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            <p className="text-slate-500 text-sm">Loading confirmed shops...</p>
          </div>
        ) : confirmedShops.length === 0 ? (
          <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl py-16 text-center">
            <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="font-semibold text-slate-700 text-lg">No Confirmed Shops</h3>
            <p className="text-sm text-slate-500 max-w-xs mx-auto mt-1">Confirmed public client stores with approved payments will be listed here.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-600 text-xs font-bold uppercase tracking-wider">
                      <th className="px-6 py-4">Shop Details</th>
                      <th className="px-6 py-4">Active Plan Details</th>
                      <th className="px-6 py-4">Manual Payment Info</th>
                      <th className="px-6 py-4">Uploaded Proof Receipt</th>
                      <th className="px-6 py-4 text-center">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                    {confirmedShops.map((shop) => (
                      <tr key={shop.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-800 text-sm">{shop.name}</div>
                          <div className="text-xs text-slate-400 font-mono mt-0.5">{shop.email}</div>
                          <div className="text-xs text-slate-500 mt-1">Phone: {shop.phone || 'N/A'}</div>
                          <div className="text-[11px] text-slate-450 italic mt-0.5 truncate max-w-xs">Addr: {shop.address || 'N/A'}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-slate-850 text-xs bg-emerald-50 border border-emerald-100 rounded px-2 py-0.5">
                            {shop.package_name || 'Standard Package'}
                          </span>
                          <div className="text-xs text-slate-600 font-bold mt-2.5">
                            Cost: {shop.price ? `${parseFloat(shop.price).toFixed(2)} T.K` : 'N/A'}
                          </div>
                          {shop.subscription_expires_at && (
                            <div className="text-[10px] text-slate-450 mt-1 font-semibold">
                              Expires: {new Date(shop.subscription_expires_at).toLocaleDateString()}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-[10px] uppercase tracking-wider text-slate-700 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">
                            {shop.payment_method ? shop.payment_method.toUpperCase() : 'N/A'}
                          </span>
                          <div className="text-xs text-slate-500 mt-2 font-mono">
                            <span className="text-slate-400">TRX/Ref:</span> {shop.transaction_id || 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {shop.payment_proof ? (
                            <div className="relative group w-24 h-16 border border-slate-200 rounded-lg overflow-hidden bg-slate-50 flex items-center justify-center cursor-pointer"
                              onClick={() => setLightboxImage(shop.payment_proof)}>
                              <img src={shop.payment_proof} alt="Proof Thumbnail" className="max-w-full max-h-full object-cover" />
                              <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] text-white font-semibold">
                                View Proof
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-450 italic">No receipt uploaded</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                            shop.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-600 border-rose-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${shop.status === 'active' ? 'bg-emerald-500' : 'bg-rose-400'}`} />
                            {shop.status === 'active' ? 'Active' : 'Suspended'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => {
                              setInvoiceData({
                                id: shop.id,
                                name: shop.name,
                                email: shop.email,
                                phone: shop.phone,
                                address: shop.address,
                                package_name: shop.package_name,
                                price: shop.price,
                                duration_days: shop.duration_days,
                                payment_method: shop.payment_method,
                                transaction_id: shop.transaction_id,
                                status: 'approved',
                                created_at: shop.created_at
                              });
                              setShowInvoice(true);
                            }}
                            className="bg-indigo-55 bg-indigo-50 hover:bg-indigo-100 text-indigo-750 text-indigo-700 font-bold py-2 px-3.5 rounded-xl text-xs transition-all border border-indigo-100/50"
                          >
                            View Invoice
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      )}

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xs"
             onClick={() => setLightboxImage(null)}>
          <div className="relative max-w-3xl max-h-[85vh] overflow-hidden bg-white rounded-2xl p-2.5 border border-slate-200"
               onClick={e => e.stopPropagation()}>
            <button className="absolute top-3 right-3 text-slate-800 bg-white/80 hover:bg-white p-2 rounded-full shadow-lg z-10 font-bold transition-all"
                    onClick={() => setLightboxImage(null)}>
              ✕
            </button>
            <img src={lightboxImage} alt="Payment Proof Full" className="max-w-full max-h-[80vh] object-contain rounded-xl" />
            <div className="p-3 text-center border-t border-slate-100 flex justify-center gap-4 bg-slate-50 rounded-b-xl mt-2.5">
              <a href={lightboxImage} download="payment_proof_receipt_full.png"
                 className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 px-4 rounded-xl transition-all shadow-md">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Receipt File
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-800">Add New Subscription Plan</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Plan Name *</label>
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g. Professional Plan"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-slate-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Price (T.K) *</label>
                  <input
                    type="number"
                    name="price"
                    step="0.01"
                    required
                    value={formData.price}
                    onChange={handleInputChange}
                    placeholder="e.g. 49.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Duration (Days) *</label>
                  <input
                    type="number"
                    name="duration_days"
                    required
                    value={formData.duration_days}
                    onChange={handleInputChange}
                    placeholder="30"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Included Features (Comma-separated)</label>
                <textarea
                  name="features"
                  value={formData.features}
                  onChange={handleInputChange}
                  rows="3"
                  placeholder="e.g. Unlimited Products, 5 Staff Members, Basic Analytics"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-sm font-semibold text-white transition-colors"
                >
                  Create Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-800">Edit Subscription Plan</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Plan Name *</label>
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Plan Name"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-slate-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Price (T.K) *</label>
                  <input
                    type="number"
                    name="price"
                    step="0.01"
                    required
                    value={formData.price}
                    onChange={handleInputChange}
                    placeholder="Price"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Duration (Days) *</label>
                  <input
                    type="number"
                    name="duration_days"
                    required
                    value={formData.duration_days}
                    onChange={handleInputChange}
                    placeholder="30"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Included Features (Comma-separated)</label>
                <textarea
                  name="features"
                  value={formData.features}
                  onChange={handleInputChange}
                  rows="3"
                  placeholder="Included Features"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-805 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-sm font-semibold text-white transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <SubscriptionInvoice
        isOpen={showInvoice}
        onClose={() => setShowInvoice(false)}
        invoice={invoiceData}
      />
    </div>
  );
}
