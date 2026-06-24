import React, { useState, useEffect } from 'react';

const API_BASE_URL = 'http://localhost:5000/api';

export default function OtherCost() {
  const userObj = JSON.parse(localStorage.getItem('user') || '{}');
  const isSuperAdmin = userObj.role === 'super_admin';

  const [costs, setCosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState(null);
  const [alert, setAlert] = useState(null);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [shops, setShops] = useState([]);
  const [selectedShopId, setSelectedShopId] = useState('');
 
  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentCost, setCurrentCost] = useState(null);
 
  // Form states
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    cost_date: new Date().toISOString().split('T')[0],
    notes: ''
  });
 
  const fetchCosts = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      let url = `${API_BASE_URL}/other-costs?`;
      if (startDate) url += `start_date=${startDate}&`;
      if (endDate) url += `end_date=${endDate}&`;
      if (isSuperAdmin && selectedShopId) {
        url += `shop_id=${selectedShopId}&`;
      }
 
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to retrieve cost records.');
      const data = await response.json();
      setCosts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
 
  useEffect(() => {
    if (isSuperAdmin) {
      const fetchShops = async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`${API_BASE_URL}/shops`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (response.ok) {
            const data = await response.json();
            setShops(data);
          }
        } catch (err) {
          console.error('Failed to fetch shops:', err);
        }
      };
      fetchShops();
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    fetchCosts();
  }, [startDate, endDate, selectedShopId]);

  const triggerAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 4000);
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // 1. CREATE COST
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.amount || !formData.cost_date) {
      triggerAlert('error', 'Please fill in all required fields.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/other-costs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: formData.title,
          amount: parseFloat(formData.amount),
          cost_date: formData.cost_date,
          notes: formData.notes
        })
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to record cost entry.');

      triggerAlert('success', 'Cost entry recorded successfully!');
      setShowAddModal(false);
      resetForm();
      fetchCosts();
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  // 2. OPEN EDIT MODAL
  const openEdit = (cost) => {
    setCurrentCost(cost);
    setFormData({
      title: cost.title,
      amount: cost.amount,
      cost_date: cost.cost_date ? cost.cost_date.split('T')[0] : '',
      notes: cost.notes || ''
    });
    setShowEditModal(true);
  };

  // 3. UPDATE COST
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/other-costs/${currentCost.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: formData.title,
          amount: parseFloat(formData.amount),
          cost_date: formData.cost_date,
          notes: formData.notes
        })
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to update cost record.');

      triggerAlert('success', 'Cost record updated successfully!');
      setShowEditModal(false);
      resetForm();
      fetchCosts();
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  // 4. DELETE COST
  const handleDelete = async (costId) => {
    if (!window.confirm('Are you sure you want to delete this cost record?')) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/other-costs/${costId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to delete cost record.');

      triggerAlert('success', 'Cost record deleted successfully!');
      fetchCosts();
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      amount: '',
      cost_date: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setCurrentCost(null);
  };

  // CSV EXPORTER
  const exportToCSV = () => {
    if (filteredCosts.length === 0) {
      triggerAlert('error', 'No cost entries to export.');
      return;
    }

    const headers = ['ID', 'Date', 'Description / Title', 'Amount (৳)', 'Notes'];
    
    const escapeCSV = (val) => {
      if (val === null || val === undefined) return '';
      let str = String(val);
      if (/[",\n\r]/.test(str)) {
        str = `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = filteredCosts.map(c => [
      c.id,
      c.cost_date ? c.cost_date.split('T')[0] : 'N/A',
      escapeCSV(c.title),
      parseFloat(c.amount).toFixed(2),
      escapeCSV(c.notes || '')
    ]);

    const csvContent = "\uFEFF" + [
      headers.join(','),
      ...rows.map(e => e.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `other_costs_ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerAlert('success', 'Expenses ledger exported successfully!');
  };

  // HELPER FORMATTERS
  const formatCurrency = (val) => `৳${parseFloat(val).toFixed(2)}`;
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    // Remove timestamp zone offset issues
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      return new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric'
      });
    }
    return new Date(dateStr).toLocaleDateString();
  };

  // FILTERED COSTS FOR CLIENT SIDE SEARCH
  const filteredCosts = costs.filter(c => {
    return c.title.toLowerCase().includes(search.toLowerCase()) || 
           (c.notes && c.notes.toLowerCase().includes(search.toLowerCase()));
  });

  // KPI STATS CALCULATION
  const totalSpent = costs.reduce((sum, c) => sum + parseFloat(c.amount), 0);
  
  const getThisMonthSpent = () => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    return costs
      .filter(c => {
        if (!c.cost_date) return false;
        const d = new Date(c.cost_date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((sum, c) => sum + parseFloat(c.amount), 0);
  };

  return (
    <div className="space-y-6">
      {/* Alerts Banner */}
      {alert && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg flex items-center transition-all ${
          alert.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
        }`}>
          <span className="text-sm font-semibold">{alert.message}</span>
        </div>
      )}
 
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Other Costs Ledger</h2>
          <p className="text-sm text-slate-500">Record and monitor shop operational expenses and overhead costs</p>
        </div>
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <button
            onClick={exportToCSV}
            className="bg-white hover:bg-slate-50 text-slate-700 font-semibold py-2.5 px-5 border border-slate-200 rounded-xl text-sm shadow-xs transition-colors flex items-center space-x-2"
          >
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Export Expenses</span>
          </button>
          {!isSuperAdmin && (
            <button
              onClick={() => { resetForm(); setShowAddModal(true); }}
              className="bg-slate-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-5 rounded-xl text-sm shadow-sm transition-colors flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Cost Entry</span>
            </button>
          )}
        </div>
      </div>
 
      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Card 1 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-rose-50 text-rose-500 rounded-xl">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Expenses</span>
          </div>
          <div className="mt-4">
            <span className="block text-2xl font-black text-slate-800">{formatCurrency(totalSpent)}</span>
            <span className="text-xs text-slate-450">All recorded operational overheads</span>
          </div>
        </div>
 
        {/* Card 2 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-indigo-50 text-indigo-500 rounded-xl">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">This Month's Overhead</span>
          </div>
          <div className="mt-4">
            <span className="block text-2xl font-black text-slate-800">{formatCurrency(getThisMonthSpent())}</span>
            <span className="text-xs text-slate-450">Overheads in current calendar month</span>
          </div>
        </div>
 
        {/* Card 3 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-slate-100 text-slate-550 rounded-xl">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Overhead Entries</span>
          </div>
          <div className="mt-4">
            <span className="block text-2xl font-black text-slate-800">{costs.length} Records</span>
            <span className="text-xs text-slate-450">Total recorded transactions</span>
          </div>
        </div>
      </div>

      {/* Dynamic Graph Chart */}
      {(() => {
        // Calculate dynamic trend data from the current loaded costs
        const trendMap = {};
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];
          trendMap[dateStr] = { date: dateStr, amount: 0 };
        }

        costs.forEach(item => {
          if (!item.cost_date) return;
          const dateStr = new Date(item.cost_date).toISOString().split('T')[0];
          if (trendMap[dateStr]) {
            trendMap[dateStr].amount += parseFloat(item.amount || 0);
          }
        });

        const chartData = Object.values(trendMap);
        const chartValues = chartData.map(d => d.amount);
        const maxVal = Math.max(...chartValues, 100);

        return (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs relative">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Expenses Trend</h3>
              <p className="text-xs text-slate-500">Daily business overhead costs recorded over the last 7 days</p>
            </div>

            <div className="relative w-full h-[180px] mt-4">
              {/* SVG Plot */}
              <svg 
                viewBox="0 0 600 180" 
                className="w-full h-full overflow-visible"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="expensesAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid Lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                  const y = 15 + (1 - ratio) * 125;
                  const labelVal = ratio * maxVal;
                  return (
                    <g key={idx}>
                      <line 
                        x1={55} 
                        y1={y} 
                        x2={575} 
                        y2={y} 
                        stroke="#f1f5f9" 
                        strokeWidth="1.5"
                      />
                      <text 
                        x={43} 
                        y={y + 4} 
                        textAnchor="end" 
                        className="text-[10px] font-bold text-slate-400 fill-current font-sans"
                      >
                        ৳{Math.round(labelVal)}
                      </text>
                    </g>
                  );
                })}

                {/* Path Logic */}
                {(() => {
                  const chartPoints = chartData.map((d, index) => {
                    const val = d.amount;
                    const x = 55 + (index * (600 - 55 - 25) / 6);
                    const y = 140 - ((val / maxVal) * 125);
                    return { x, y, val, date: d.date };
                  });

                  const linePath = chartPoints.reduce((path, pt, i) => {
                    return path + (i === 0 ? `M ${pt.x} ${pt.y}` : ` L ${pt.x} ${pt.y}`);
                  }, '');

                  const areaPath = `${linePath} L ${chartPoints[chartPoints.length - 1].x} 140 L ${chartPoints[0].x} 140 Z`;

                  return (
                    <>
                      <path d={areaPath} fill="url(#expensesAreaGradient)" />
                      <path 
                        d={linePath} 
                        fill="none" 
                        stroke="#ef4444" 
                        strokeWidth="2.5" 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                      />

                      {chartPoints.map((pt, idx) => (
                        <g key={idx}>
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r="15"
                            fill="transparent"
                            className="cursor-pointer"
                            onMouseEnter={() => setHoveredPoint({ ...pt, index: idx })}
                            onMouseLeave={() => setHoveredPoint(null)}
                          />
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={hoveredPoint?.index === idx ? "5" : "3.5"}
                            fill={hoveredPoint?.index === idx ? "#ef4444" : "#ffffff"}
                            stroke="#ef4444"
                            strokeWidth={hoveredPoint?.index === idx ? "2.5" : "1.5"}
                            className="pointer-events-none transition-all duration-150"
                          />
                        </g>
                      ))}

                      {chartPoints.map((pt, idx) => {
                        const dateObj = new Date(pt.date);
                        const label = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        return (
                          <text
                            key={idx}
                            x={pt.x}
                            y={160}
                            textAnchor="middle"
                            className="text-[10px] font-bold text-slate-400 fill-current font-sans"
                          >
                            {label}
                          </text>
                        );
                      })}
                    </>
                  );
                })()}
              </svg>

              {/* Tooltip */}
              {hoveredPoint && (
                <div
                  className="absolute bg-slate-900/95 backdrop-blur-md text-white rounded-xl p-2.5 shadow-xl border border-slate-700 pointer-events-none text-xs flex flex-col space-y-0.5 transition-all duration-75 z-10"
                  style={{
                    left: `${(hoveredPoint.x / 600) * 100}%`,
                    top: `${(hoveredPoint.y / 180) * 100 - 5}%`,
                    transform: 'translate(-50%, -100%)'
                  }}
                >
                  <span className="font-semibold text-slate-400">
                    {new Date(hoveredPoint.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                  <span className="font-extrabold text-white text-sm">
                    Expense: ৳{parseFloat(hoveredPoint.val).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })()}
 
      {/* Filters Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <input
            type="text"
            placeholder="Search descriptions/notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <svg className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
 
        {/* Date Filters */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600">
          {isSuperAdmin && (
            <div className="flex items-center space-x-2 mr-4">
              <span className="text-slate-500">Tenant Shop:</span>
              <select
                value={selectedShopId}
                onChange={(e) => setSelectedShopId(e.target.value)}
                className="border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-700 font-medium"
              >
                <option value="">All Shops (Consolidated)</option>
                {shops.map((shop) => (
                  <option key={shop.id} value={shop.id}>
                    {shop.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <span>From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div className="flex items-center space-x-2">
            <span>To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 outline-none"
            />
          </div>
          {(startDate || endDate || (isSuperAdmin && selectedShopId)) && (
            <button
              onClick={() => { setStartDate(''); setEndDate(''); setSelectedShopId(''); }}
              className="text-indigo-600 hover:text-indigo-850 font-bold ml-2 underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>
 
      {/* Ledger Table Container */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                <th className="p-4">Cost Date</th>
                {isSuperAdmin && <th className="p-4">Shop</th>}
                <th className="p-4">Description</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Notes</th>
                {!isSuperAdmin && <th className="p-4 text-center">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 5 : 5} className="p-12 text-center">
                    <div className="flex justify-center items-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
                    </div>
                  </td>
                </tr>
              ) : filteredCosts.length === 0 ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 5 : 5} className="p-12 text-center text-slate-400">
                    No cost entries matched current search criteria or date ranges.
                  </td>
                </tr>
              ) : (
                filteredCosts.map((cost) => (
                  <tr key={cost.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 font-semibold text-slate-700">{formatDate(cost.cost_date)}</td>
                    {isSuperAdmin && <td className="p-4 font-semibold text-slate-700">{cost.shop_name}</td>}
                    <td className="p-4 font-bold text-slate-800">{cost.title}</td>
                    <td className="p-4 font-black text-rose-600">{formatCurrency(cost.amount)}</td>
                    <td className="p-4 text-slate-500 italic max-w-xs truncate">{cost.notes || '-'}</td>
                    {!isSuperAdmin && (
                      <td className="p-4 text-center space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => openEdit(cost)}
                          className="text-indigo-600 hover:text-indigo-900 font-semibold text-xs border border-indigo-100 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(cost.id)}
                          className="text-rose-600 hover:text-rose-900 font-semibold text-xs border border-rose-100 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg transition-colors"
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- ADD NEW COST MODAL --- */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl overflow-hidden flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">Add New Cost Entry</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleAddSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Description / Title *</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g. Electricity bill (June)"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Amount (৳) *</label>
                  <input
                    type="number"
                    step="0.01"
                    name="amount"
                    value={formData.amount}
                    onChange={handleInputChange}
                    required
                    placeholder="e.g. 4500"
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Cost Date *</label>
                  <input
                    type="date"
                    name="cost_date"
                    value={formData.cost_date}
                    onChange={handleInputChange}
                    required
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Optional Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows="3"
                  placeholder="Payment receipt ref, paid by cash, etc."
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-indigo-500 outline-none bg-white"
                />
              </div>

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
                  Save Cost Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- EDIT COST MODAL --- */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl overflow-hidden flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">Edit Cost Entry</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Description / Title *</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Amount (৳) *</label>
                  <input
                    type="number"
                    step="0.01"
                    name="amount"
                    value={formData.amount}
                    onChange={handleInputChange}
                    required
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Cost Date *</label>
                  <input
                    type="date"
                    name="cost_date"
                    value={formData.cost_date}
                    onChange={handleInputChange}
                    required
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Optional Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows="3"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-indigo-500 outline-none bg-white"
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
