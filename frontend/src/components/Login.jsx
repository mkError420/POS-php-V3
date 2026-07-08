import React, { useState, useEffect } from 'react';
import API_BASE_URL from '../config';
import logo from '../assets/logo.png';
import SubscriptionInvoice from './SubscriptionInvoice';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Subscription states
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [packages, setPackages] = useState([]);
  const [selectedPkg, setSelectedPkg] = useState(null);

  // Payment options configured by super admin
  const [paymentMethods, setPaymentMethods] = useState({
    bkash: '',
    nagad: '',
    bank_name: '',
    bank_account_name: '',
    bank_account_no: '',
    bank_routing: ''
  });

  const [signupForm, setSignupForm] = useState({
    shop_name: '',
    shop_email: '',
    shop_phone: '',
    shop_address: '',
    admin_name: '',
    admin_email: '',
    admin_password: '',
    payment_method: 'bkash', // bkash, nagad, bank_transfer
    transaction_id: '',
    payment_proof: null
  });

  const [processingPayment, setProcessingPayment] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceData, setInvoiceData] = useState(null);

  // Fetch active packages and manual payment instructions on mount
  useEffect(() => {
    setError('');

    // Fetch packages
    fetch(`${API_BASE_URL}/packages`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load packages.');
        return res.json();
      })
      .then(data => setPackages(data))
      .catch(err => console.error('Packages fetch error:', err));

    // Fetch manual payment methods
    fetch(`${API_BASE_URL}/payment-methods`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load payment methods.');
        return res.json();
      })
      .then(data => {
        if (data) setPaymentMethods(data);
      })
      .catch(err => console.error('Payment methods fetch error:', err));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed. Please check your credentials.');
        setLoading(false);
        return;
      }

      // Store token and user info
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      onLoginSuccess(data.user);
    } catch (err) {
      setError('Cannot connect to server. Make sure the backend is running.');
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSignupForm(prev => ({ ...prev, payment_proof: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!signupForm.shop_name || !signupForm.shop_email || !signupForm.admin_name || !signupForm.admin_email || !signupForm.admin_password) {
      setError('Please fill in all required store and administrator account details.');
      return;
    }

    if (!signupForm.transaction_id || !signupForm.payment_proof) {
      setError('Please complete the manual payment step, provide a Transaction ID, and upload payment receipt document.');
      return;
    }

    setProcessingPayment(true);

    // Simulate submission delay
    setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/public-signup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify({
            ...signupForm,
            package_id: selectedPkg.id
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Registration failed.');
          setProcessingPayment(false);
          return;
        }

        setSuccess(data.message || 'Subscription request submitted successfully. Awaiting approval.');
        setProcessingPayment(false);

        // Open subscription invoice slip for client
        setInvoiceData({
          id: data.shop_id || 'PENDING',
          name: signupForm.shop_name,
          email: signupForm.shop_email,
          phone: signupForm.shop_phone,
          address: signupForm.shop_address,
          package_name: selectedPkg.name,
          price: selectedPkg.price,
          duration_days: selectedPkg.duration_days,
          payment_method: signupForm.payment_method,
          transaction_id: signupForm.transaction_id,
          status: 'pending'
        });
        setShowInvoice(true);

      } catch (err) {
        setError('Cannot connect to server. Registration failed.');
        setProcessingPayment(false);
      }
    }, 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden py-12 px-4">
      {/* Animated background blobs */}
      <div className="absolute top-[-10%] left-[-5%] w-96 h-96 bg-slate-600/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-5%] w-96 h-96 bg-violet-600/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-900/10 rounded-full blur-3xl" />

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-6xl mx-auto">

        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-900 border border-slate-700/50 shadow-2xl shadow-indigo-600/40 mb-4 overflow-hidden">
            <img src={logo} alt="Codexaa-POS Logo" className="w-full h-full object-contain p-2" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Codexaa-POS</h1>
          <p className="text-slate-400 mt-1 text-sm">Professional Web-Based Multi-Tenant POS Platform</p>
        </div>

        {error && (
          <div className="flex items-start gap-3 bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 max-w-md mx-auto mb-6">
            <svg className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-rose-300 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 max-w-lg mx-auto mb-6 animate-pulse">
            <svg className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-emerald-300 text-sm">
              <p className="font-bold">{success}</p>
              <p className="text-xs text-slate-400 mt-1">Our administrator is reviewing your payment transaction. You will be redirected shortly.</p>
            </div>
          </div>
        )}

        {/* --- MODE: SIGN IN SIDE-BY-SIDE WITH PRICING --- */}
        {mode === 'signin' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">

            {/* Left Column: Sign In Card */}
            <div className="lg:col-span-4 bg-slate-900/80 backdrop-blur-xl border border-slate-700/60 rounded-2xl p-6 shadow-2xl flex flex-col justify-between space-y-6">
              <div>
                <div className="border-b border-slate-800 pb-3 mb-5">
                  <span className="text-lg font-bold text-white">Sign In</span>
                  <p className="text-slate-500 text-xs mt-0.5">Access your administrator or staff dashboard.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="email" className="block text-xs font-medium text-slate-300 mb-1.5">Email address</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                        </svg>
                      </div>
                      <input
                        id="email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="admin@example.com"
                        className="w-full bg-slate-800/60 border border-slate-600/60 text-white placeholder-slate-500 rounded-xl pl-9 pr-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-xs font-medium text-slate-300 mb-1.5">Password</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-slate-800/60 border border-slate-600/60 text-white placeholder-slate-500 rounded-xl pl-9 pr-10 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        {showPassword ? (
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
                  </div>

                  <button
                    id="login-submit-btn"
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-600/50 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-2.5 text-xs transition-all duration-200 shadow-lg shadow-indigo-600/30 hover:shadow-indigo-500/40 hover:-translate-y-0.5 active:translate-y-0"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Signing in...
                      </>
                    ) : (
                      <>
                        Sign In
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Demo Credentials */}
              <div className="pt-4 border-t border-slate-800 space-y-2">
                <p className="text-[10px] text-slate-500 text-center font-semibold uppercase tracking-wider">Demo Credentials</p>
                <div className="grid grid-cols-1 gap-1.5">
                  <button
                    type="button"
                    onClick={() => { setEmail('superadmin@mkpos.com'); setPassword('123456789'); }}
                    className="flex items-center gap-2.5 w-full text-left bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl px-3 py-2 transition-colors group"
                  >
                    <span className="text-[8px] font-bold bg-rose-500/25 text-rose-400 px-1.5 py-0.5 rounded-full shrink-0">SUPER ADMIN</span>
                    <span className="text-[10px] text-slate-400 group-hover:text-slate-300 transition-colors truncate">superadmin@mkpos.com</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEmail('new@gmail.com'); setPassword('123456'); }}
                    className="flex items-center gap-2.5 w-full text-left bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-xl px-3 py-2 transition-colors group"
                  >
                    <span className="text-[8px] font-bold bg-indigo-500/25 text-indigo-400 px-1.5 py-0.5 rounded-full shrink-0">SHOP ADMIN</span>
                    <span className="text-[10px] text-slate-400 group-hover:text-slate-300 transition-colors truncate">new@gmail.com · 123456</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEmail('staff1@boutique.com'); setPassword('staff123'); }}
                    className="flex items-center gap-2.5 w-full text-left bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl px-3 py-2 transition-colors group"
                  >
                    <span className="text-[8px] font-bold bg-amber-500/25 text-amber-400 px-1.5 py-0.5 rounded-full shrink-0">SHOP STAFF</span>
                    <span className="text-[10px] text-slate-400 group-hover:text-slate-300 transition-colors truncate">staff1@boutique.com</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Pricing & Subscription plans */}
            <div className="lg:col-span-8 flex flex-col space-y-4">
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl px-6 py-4">
                <span className="text-base font-bold text-white">Create Store & Subscribe</span>
                <p className="text-slate-500 text-xs mt-0.5">Choose a subscription package below to set up your store and admin account instantly.</p>
              </div>

              {packages.length === 0 ? (
                <div className="flex-1 bg-slate-900/40 border border-slate-800 border-dashed rounded-2xl flex flex-col items-center justify-center p-12 text-slate-500 text-center">
                  <svg className="animate-spin h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full mb-3" viewBox="0 0 24 24" />
                  <span className="text-xs">Fetching subscription plans…</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
                  {packages.map((pkg) => (
                    <div
                      key={pkg.id}
                      className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-5 shadow-xl transition-all duration-300 hover:scale-[1.02] flex flex-col justify-between"
                    >
                      <div>
                        <h3 className="text-sm font-extrabold text-white tracking-wide uppercase">{pkg.name}</h3>
                        <p className="text-slate-400 text-[10px] mt-0.5">Plan duration: {pkg.duration_days} Days</p>

                        <div className="mt-4 border-t border-slate-800 pt-3 mb-4">
                          <span className="text-2xl font-extrabold text-white">{pkg.price.toFixed(2)} T.K</span>
                          <span className="text-slate-500 text-[10px] font-medium"> / plan</span>
                        </div>

                        <div className="space-y-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Features:</span>
                          {pkg.features ? (
                            pkg.features.split(',').map((f, i) => (
                              <div key={i} className="flex items-start gap-1.5 text-slate-355 text-xs">
                                <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                </svg>
                                <span className="leading-tight text-[11px] text-slate-300">{f.trim()}</span>
                              </div>
                            ))
                          ) : (
                            <p className="text-slate-550 italic text-[10px]">Standard capabilities access</p>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedPkg(pkg);
                          setMode('signup');
                          setSignupForm(prev => ({
                            ...prev,
                            payment_method: 'bkash',
                            transaction_id: '',
                            payment_proof: null
                          }));
                        }}
                        className="w-full mt-6 bg-indigo-650 hover:bg-indigo-600 hover:shadow-indigo-500/20 text-white font-semibold py-2 px-3 rounded-xl text-xs transition-all shadow-md active:translate-y-0.5"
                      >
                        Subscribe to {pkg.name.split(' ')[0]}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* --- MODE: SIGNUP & MANUAL PAYMENT UPLOAD --- */}
        {mode === 'signup' && selectedPkg && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fadeIn">

            {/* Left Column: Forms */}
            <form onSubmit={handleSignupSubmit} className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-lg font-bold text-white">Store Setup & Subscribe ({selectedPkg.name})</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Please fill your account details and provide manual payment proof.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMode('signin')}
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  ← Back to Home
                </button>
              </div>

              {/* Step 1: Shop & Account details */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1.5">1. Store Details</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Shop Name *</label>
                    <input
                      type="text"
                      required
                      value={signupForm.shop_name}
                      onChange={e => setSignupForm({ ...signupForm, shop_name: e.target.value })}
                      placeholder="e.g. Uptown Grocers"
                      className="w-full bg-gray-600 border border-gray-500 text-white placeholder-slate-500 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Shop Email *</label>
                    <input
                      type="email"
                      required
                      value={signupForm.shop_email}
                      onChange={e => setSignupForm({ ...signupForm, shop_email: e.target.value })}
                      placeholder="contact@shop.com"
                      className="w-full bg-gray-600 border border-gray-500 text-white placeholder-slate-500 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Store Phone</label>
                    <input
                      type="text"
                      value={signupForm.shop_phone}
                      onChange={e => setSignupForm({ ...signupForm, shop_phone: e.target.value })}
                      placeholder="555-0100"
                      className="w-full bg-gray-600 border border-gray-500 text-white placeholder-slate-500 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Store Address</label>
                    <input
                      type="text"
                      value={signupForm.shop_address}
                      onChange={e => setSignupForm({ ...signupForm, shop_address: e.target.value })}
                      placeholder="123 Main St, City"
                      className="w-full bg-gray-600 border border-gray-500 text-white placeholder-slate-500 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1.5 pt-2">2. Administrator Account</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Admin Full Name *</label>
                    <input
                      type="text"
                      required
                      value={signupForm.admin_name}
                      onChange={e => setSignupForm({ ...signupForm, admin_name: e.target.value })}
                      placeholder="e.g. John Doe"
                      className="w-full bg-gray-600 border border-gray-500 text-white placeholder-slate-500 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Admin Email *</label>
                    <input
                      type="email"
                      required
                      value={signupForm.admin_email}
                      onChange={e => setSignupForm({ ...signupForm, admin_email: e.target.value })}
                      placeholder="admin@shop.com"
                      className="w-full bg-gray-600 border border-gray-500 text-white placeholder-slate-500 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Admin Password *</label>
                  <input
                    type="password"
                    required
                    value={signupForm.admin_password}
                    onChange={e => setSignupForm({ ...signupForm, admin_password: e.target.value })}
                    placeholder="•••••••• (Min. 6 characters)"
                    className="w-full bg-gray-600 border border-gray-500 text-white placeholder-slate-500 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Step 2: Payment Details */}
              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1.5">3. Manual Payment Verification Details</h4>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-2">Select Your Payment Channel *</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: 'bkash', label: 'bKash (Mobile)' },
                        { id: 'nagad', label: 'Nagad (Mobile)' },
                        { id: 'bank_transfer', label: 'Bank Transfer' }
                      ].map((channel) => (
                        <label
                          key={channel.id}
                          className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all ${signupForm.payment_method === channel.id
                            ? 'border-indigo-650 bg-indigo-500/10 text-white'
                            : 'border-slate-800 bg-slate-850/40 text-slate-400 hover:border-slate-750'
                            }`}
                        >
                          <input
                            type="radio"
                            name="payment_method"
                            value={channel.id}
                            checked={signupForm.payment_method === channel.id}
                            onChange={e => setSignupForm({ ...signupForm, payment_method: e.target.value })}
                            className="sr-only"
                          />
                          <span className="text-xs font-bold">{channel.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Transaction ID / Reference *</label>
                      <input
                        type="text"
                        required
                        value={signupForm.transaction_id}
                        onChange={e => setSignupForm({ ...signupForm, transaction_id: e.target.value })}
                        placeholder="e.g. TRX82938102"
                        className="w-full bg-gray-600 border border-gray-500 text-white placeholder-slate-505 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Upload Payment Proof Receipt *</label>
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          required
                          onChange={handleFileChange}
                          className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-gray-600 file:text-white hover:file:bg-gray-700 file:cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                  {signupForm.payment_proof && (
                    <div className="border border-slate-800 rounded-xl p-2 bg-slate-850/30 flex items-center gap-3">
                      <div className="w-12 h-12 rounded bg-slate-800 overflow-hidden flex items-center justify-center shrink-0 border border-slate-700">
                        <img src={signupForm.payment_proof} alt="Proof receipt preview" className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <span className="text-xs text-white font-medium block">Document Proof Loaded</span>
                        <span className="text-[10px] text-slate-500 block">Ready for upload (base64 converted)</span>
                      </div>
                    </div>
                  )}

                </div>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={processingPayment}
                className="w-full flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-600/50 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 text-xs transition-all shadow-lg shadow-gray-600/20 active:translate-y-0.5"
              >
                {processingPayment ? (
                  <>
                    <svg className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full shrink-0" fill="none" viewBox="0 0 24 24" />
                    Submitting Request & Transaction Info...
                  </>
                ) : (
                  <>
                    Submit Verification & Request Subscription ({selectedPkg.price.toFixed(2)} T.K)
                  </>
                )}
              </button>
            </form>

            {/* Right Column: Order Summary & Payment Instructions */}
            <div className="lg:col-span-5 space-y-6">

              {/* Payment Instructions Board */}
              <div className="w-full bg-gradient-to-br from-slate-900 to-indigo-950 rounded-2xl p-6 shadow-2xl relative overflow-hidden border border-indigo-500/20 text-white">
                <div className="absolute top-[-50%] right-[-30%] w-72 h-72 bg-white/5 rounded-full blur-2xl" />

                <h4 className="text-xs uppercase font-extrabold tracking-widest text-indigo-400">Manual Payment Instructions</h4>
                <p className="text-xs text-slate-400 mt-1 mb-4">Please transfer the amount manually using the details below before submitting the form.</p>

                {signupForm.payment_method === 'bkash' && (
                  <div className="space-y-3 bg-slate-950/40 border border-slate-800 rounded-xl p-4 animate-fadeIn">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-pink-500 animate-ping" />
                      bKash Send Money
                    </span>
                    <div className="text-xs text-slate-300 space-y-1">
                      <p>1. Go to your bKash App and select **Send Money**.</p>
                      <p>2. Enter our bKash Number: <span className="font-bold text-pink-400 font-mono">{paymentMethods.bkash || '01700000000'}</span></p>
                      <p>3. Enter Subscription Amount: <span className="font-bold text-white font-mono">{selectedPkg.price.toFixed(2)} T.K</span></p>
                      <p>4. Put Reference: <span className="italic text-slate-400">{signupForm.shop_name || 'Your Shop Name'}</span></p>
                    </div>
                  </div>
                )}

                {signupForm.payment_method === 'nagad' && (
                  <div className="space-y-3 bg-slate-950/40 border border-slate-800 rounded-xl p-4 animate-fadeIn">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
                      Nagad Send Money
                    </span>
                    <div className="text-xs text-slate-300 space-y-1">
                      <p>1. Go to your Nagad App and choose **Send Money**.</p>
                      <p>2. Enter our Nagad Number: <span className="font-bold text-orange-400 font-mono">{paymentMethods.nagad || '01800000000'}</span></p>
                      <p>3. Enter Subscription Amount: <span className="font-bold text-white font-mono">{selectedPkg.price.toFixed(2)} T.K</span></p>
                      <p>4. Put Reference: <span className="italic text-slate-400">{signupForm.shop_name || 'Your Shop Name'}</span></p>
                    </div>
                  </div>
                )}

                {signupForm.payment_method === 'bank_transfer' && (
                  <div className="space-y-3 bg-slate-950/40 border border-slate-800 rounded-xl p-4 animate-fadeIn">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                      Direct Bank Transfer
                    </span>
                    <div className="text-xs text-slate-300 space-y-1 font-mono text-[11px] leading-relaxed">
                      <p><span className="text-slate-400">Bank:</span> {paymentMethods.bank_name || 'Demo Bank PLC'}</p>
                      <p><span className="text-slate-400">Name:</span> {paymentMethods.bank_account_name || 'Codexaa POS Solutions'}</p>
                      <p><span className="text-slate-400">A/C No:</span> {paymentMethods.bank_account_no || '123456789012'}</p>
                      <p><span className="text-slate-400">Routing:</span> {paymentMethods.bank_routing || '120345678'}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Order Summary */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
                <h3 className="font-bold text-white text-base">Plan Purchase Summary</h3>
                <div className="divide-y divide-slate-800 text-sm">
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-400">Subscription Package</span>
                    <span className="text-white font-semibold">{selectedPkg.name}</span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-400">Billing Duration</span>
                    <span className="text-white">{selectedPkg.duration_days} Days</span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-400">Subtotal Price</span>
                    <span className="text-white font-bold">{selectedPkg.price.toFixed(2)} T.K</span>
                  </div>
                  <div className="py-3 flex justify-between text-base font-bold text-white border-t border-slate-700/50">
                    <span>Total Cost</span>
                    <span className="text-indigo-400">{selectedPkg.price.toFixed(2)} T.K</span>
                  </div>
                </div>
                <div className="bg-slate-850 border border-slate-800 rounded-xl p-3 text-xs text-slate-400 flex items-start gap-2">
                  <svg className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>This is a manual payment verification workflow. Once you submit the registration form and receipt, the super admin will verify it and activate your storefront.</span>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Footer info */}
        <p className="text-center text-slate-600 text-xs mt-8">
          Multi-Tenant Point of Sale System &copy; {new Date().getFullYear()}
          developed by <a href="https://its-mk.netlify.app/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-400 transition-colors">MK</a>
        </p>
      </div>

      <SubscriptionInvoice
        isOpen={showInvoice}
        onClose={() => {
          setShowInvoice(false);
          setMode('signin');
          setSuccess('');
        }}
        invoice={invoiceData}
      />
    </div>
  );
}