import React, { useState, useEffect } from 'react';
import API_BASE_URL from '../config';

export default function Dashboard({ onNavigate = () => { } }) {
  const userObj = JSON.parse(localStorage.getItem('user') || '{}');
  const isSuperAdmin = userObj.role === 'super_admin';

  const [metrics, setMetrics] = useState({
    total_sales: 0,
    revenue: '0.00',
    total_products: 0,
    low_stock_alerts: 0,
    total_customers: 0,
    total_shops: 0,
    active_shops: 0,
    total_users: 0,
    global_revenue: '0.00'
  });
  const [recentSales, setRecentSales] = useState([]);
  const [tenantBreakdown, setTenantBreakdown] = useState([]);
  const [salesTrend, setSalesTrend] = useState([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState([]);
  const [topSelling, setTopSelling] = useState([]);
  const [deadStock, setDeadStock] = useState([]);
  const [chartType, setChartType] = useState('revenue'); // 'revenue' or 'sales'
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/analytics`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch analytics.');
      const data = await response.json();

      if (data.metrics) {
        setMetrics(data.metrics);
      }
      if (data.recent_sales) {
        setRecentSales(data.recent_sales);
      }
      if (data.tenant_breakdown) {
        setTenantBreakdown(data.tenant_breakdown);
      }
      if (data.sales_trend) {
        setSalesTrend(data.sales_trend);
      }
      if (data.payment_method_breakdown) {
        setPaymentBreakdown(data.payment_method_breakdown);
      }
      if (data.top_selling) {
        setTopSelling(data.top_selling);
      }
      if (data.dead_stock) {
        setDeadStock(data.dead_stock);
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-50 text-rose-600 border border-rose-100 rounded-xl p-4 text-center">
        Error loading analytics: {error}
      </div>
    );
  }

  if (isSuperAdmin) {
    return (
      <div className="space-y-6">

        {/* ── 1. Header ─────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Global System Analytics</h2>
            <p className="text-sm text-slate-500 mt-0.5">Real-time cross-tenant metrics and shop performance indicators</p>
          </div>
          <button
            onClick={fetchDashboardData}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow transition-colors self-start sm:self-auto"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* ── 2. Metrics Grid (6 cards) ──────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">

          {/* Global Revenue */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center space-x-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Gross System Revenue</p>
              <h3 className="text-2xl font-extrabold text-slate-800 mt-0.5">৳{parseFloat(metrics.global_revenue || 0).toFixed(2)}</h3>
            </div>
          </div>

          {/* Today's Revenue */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center space-x-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Today's Revenue</p>
              <h3 className="text-2xl font-extrabold text-slate-800 mt-0.5">৳{parseFloat(metrics.today_revenue || 0).toFixed(2)}</h3>
              <p className="text-[11px] text-slate-400">{metrics.today_sales || 0} transactions today</p>
            </div>
          </div>

          {/* Active Shops */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center space-x-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Tenant Shops</p>
              <h3 className="text-2xl font-extrabold text-slate-800 mt-0.5">{metrics.active_shops} <span className="text-lg font-medium text-slate-400">/ {metrics.total_shops}</span></h3>
              <p className="text-[11px] text-slate-400">{metrics.total_shops - metrics.active_shops > 0 ? `${metrics.total_shops - metrics.active_shops} suspended` : 'All shops active'}</p>
            </div>
          </div>

          {/* Total Sales */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center space-x-4">
            <div className="p-3 bg-sky-50 text-sky-600 rounded-xl shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Sales Count</p>
              <h3 className="text-2xl font-extrabold text-slate-800 mt-0.5">{metrics.total_sales}</h3>
            </div>
          </div>

          {/* Today's Sales */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center space-x-4">
            <div className="p-3 bg-violet-50 text-violet-600 rounded-xl shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Today's Transactions</p>
              <h3 className="text-2xl font-extrabold text-slate-800 mt-0.5">{metrics.today_sales || 0}</h3>
            </div>
          </div>

          {/* Total System Users */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center space-x-4">
            <div className="p-3 bg-rose-50 text-rose-500 rounded-xl shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total System Users</p>
              <h3 className="text-2xl font-extrabold text-slate-800 mt-0.5">{metrics.total_users}</h3>
            </div>
          </div>

        </div>

        {/* ── 3. Global 7-Day Revenue Trend Chart ───────────────────────── */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs relative">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-800">7-Day Global Revenue Trend</h3>
              <p className="text-xs text-slate-500">Combined transaction volume and gross revenues across all shops</p>
            </div>
            <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200/60 self-end sm:self-auto">
              <button
                onClick={() => setChartType('revenue')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${chartType === 'revenue' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Revenue (৳)
              </button>
              <button
                onClick={() => setChartType('sales')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${chartType === 'sales' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Transactions
              </button>
            </div>
          </div>

          {salesTrend.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
              No trend data available yet.
            </div>
          ) : (
            <div className="relative w-full h-[220px]">
              <svg viewBox="0 0 600 220" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="superAdminGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid Lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                  const svgHeight = 220, paddingTop = 20, paddingBottom = 40, paddingLeft = 60, paddingRight = 25;
                  const y = paddingTop + (1 - ratio) * (svgHeight - paddingTop - paddingBottom);
                  const chartValues = salesTrend.map(d => chartType === 'revenue' ? parseFloat(d.revenue) : parseInt(d.sales_count));
                  const maxVal = Math.max(...chartValues, 10);
                  const labelVal = ratio * maxVal;
                  return (
                    <g key={idx}>
                      <line x1={paddingLeft} y1={y} x2={600 - paddingRight} y2={y} stroke="#f1f5f9" strokeWidth="1.5" />
                      <text x={paddingLeft - 8} y={y + 4} textAnchor="end" className="text-[10px] font-bold text-slate-400 fill-current font-sans">
                        {chartType === 'revenue' ? `৳${Math.round(labelVal)}` : Math.round(labelVal)}
                      </text>
                    </g>
                  );
                })}

                {/* Line + Area + Dots */}
                {(() => {
                  const svgWidth = 600, svgHeight = 220;
                  const paddingLeft = 60, paddingRight = 25, paddingTop = 20, paddingBottom = 40;
                  const chartValues = salesTrend.map(d => chartType === 'revenue' ? parseFloat(d.revenue) : parseInt(d.sales_count));
                  const maxVal = Math.max(...chartValues, 10);
                  const pts = salesTrend.map((d, i) => {
                    const val = chartType === 'revenue' ? parseFloat(d.revenue) : parseInt(d.sales_count);
                    const x = paddingLeft + (i * (svgWidth - paddingLeft - paddingRight) / (salesTrend.length - 1 || 1));
                    const y = svgHeight - paddingBottom - ((val / maxVal) * (svgHeight - paddingTop - paddingBottom));
                    return { x, y, val, date: d.date };
                  });
                  const linePath = pts.reduce((p, pt, i) => p + (i === 0 ? `M ${pt.x} ${pt.y}` : ` L ${pt.x} ${pt.y}`), '');
                  const areaPath = `${linePath} L ${pts[pts.length - 1].x} ${svgHeight - paddingBottom} L ${pts[0].x} ${svgHeight - paddingBottom} Z`;
                  return (
                    <>
                      <path d={areaPath} fill="url(#superAdminGradient)" />
                      <path d={linePath} fill="none" stroke="#4f46e5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      {pts.map((pt, idx) => (
                        <g key={idx}>
                          <circle cx={pt.x} cy={pt.y} r="18" fill="transparent" className="cursor-pointer"
                            onMouseEnter={() => setHoveredPoint({ ...pt, index: idx })}
                            onMouseLeave={() => setHoveredPoint(null)} />
                          <circle cx={pt.x} cy={pt.y}
                            r={hoveredPoint?.index === idx ? "6" : "4.5"}
                            fill={hoveredPoint?.index === idx ? "#4f46e5" : "#ffffff"}
                            stroke="#4f46e5"
                            strokeWidth={hoveredPoint?.index === idx ? "3" : "2"}
                            className="pointer-events-none transition-all duration-150" />
                        </g>
                      ))}
                      {pts.map((pt, idx) => {
                        const label = new Date(pt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        return (
                          <text key={idx} x={pt.x} y={svgHeight - 12} textAnchor="middle"
                            className="text-[10px] font-bold text-slate-400 fill-current font-sans">
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
                  className="absolute bg-slate-900/95 backdrop-blur-md text-white rounded-xl p-3 shadow-xl border border-slate-700 pointer-events-none text-xs flex flex-col space-y-1 z-10"
                  style={{ left: `${(hoveredPoint.x / 600) * 100}%`, top: `${(hoveredPoint.y / 220) * 100 - 10}%`, transform: 'translate(-50%, -100%)' }}
                >
                  <span className="font-semibold text-slate-400">
                    {new Date(hoveredPoint.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                  <span className="font-extrabold text-white text-sm">
                    {chartType === 'revenue' ? `৳${parseFloat(hoveredPoint.val).toFixed(2)}` : `${hoveredPoint.val} Transactions`}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── 4. Shop Performance Bar Chart ─────────────────────────────── */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs relative">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Shop Performance Breakdown</h3>
              <p className="text-xs text-slate-500">Comparing transaction counts and gross revenues across all tenant shops</p>
            </div>
            <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200/60 self-end sm:self-auto">
              <button
                onClick={() => setChartType('revenue')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${chartType === 'revenue' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Revenue (৳)
              </button>
              <button
                onClick={() => setChartType('sales')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${chartType === 'sales' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Transactions
              </button>
            </div>
          </div>

          {tenantBreakdown.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
              No tenant breakdown data available.
            </div>
          ) : (
            <div className="relative w-full h-[220px]">
              <svg viewBox="0 0 600 220" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                  const svgHeight = 220, paddingTop = 20, paddingBottom = 40, paddingLeft = 65, paddingRight = 25;
                  const y = paddingTop + (1 - ratio) * (svgHeight - paddingTop - paddingBottom);
                  const chartValues = tenantBreakdown.map(d => chartType === 'revenue' ? parseFloat(d.shop_revenue || 0) : parseInt(d.sales_count || 0));
                  const maxVal = Math.max(...chartValues, 10);
                  const labelVal = ratio * maxVal;
                  return (
                    <g key={idx}>
                      <line x1={paddingLeft} y1={y} x2={600 - paddingRight} y2={y} stroke="#f1f5f9" strokeWidth="1.5" />
                      <text x={paddingLeft - 12} y={y + 4} textAnchor="end" className="text-[10px] font-bold text-slate-400 fill-current font-sans">
                        {chartType === 'revenue' ? `৳${Math.round(labelVal)}` : Math.round(labelVal)}
                      </text>
                    </g>
                  );
                })}

                {(() => {
                  const svgWidth = 600, svgHeight = 220;
                  const paddingLeft = 65, paddingRight = 25, paddingTop = 20, paddingBottom = 40;
                  const chartValues = tenantBreakdown.map(d => chartType === 'revenue' ? parseFloat(d.shop_revenue || 0) : parseInt(d.sales_count || 0));
                  const maxVal = Math.max(...chartValues, 10);
                  const totalSum = chartValues.reduce((a, b) => a + b, 0);
                  const barWidth = Math.min(40, ((svgWidth - paddingLeft - paddingRight) / tenantBreakdown.length) * 0.5);
                  const gap = (svgWidth - paddingLeft - paddingRight) / tenantBreakdown.length;

                  return tenantBreakdown.map((d, index) => {
                    const val = chartType === 'revenue' ? parseFloat(d.shop_revenue || 0) : parseInt(d.sales_count || 0);
                    const barHeight = (val / maxVal) * (svgHeight - paddingTop - paddingBottom);
                    const x = paddingLeft + (index * gap) + (gap - barWidth) / 2;
                    const y = svgHeight - paddingBottom - barHeight;
                    const percent = totalSum > 0 ? ((val / totalSum) * 100).toFixed(1) : 0;
                    return (
                      <g key={index}>
                        <rect x={paddingLeft + index * gap} y={paddingTop} width={gap} height={svgHeight - paddingTop - paddingBottom}
                          fill="transparent" className="cursor-pointer"
                          onMouseEnter={() => setHoveredPoint({ x: x + barWidth / 2, y, val, name: d.shop_name, percent, index })}
                          onMouseLeave={() => setHoveredPoint(null)} />
                        <rect x={x} y={y} width={barWidth} height={barHeight} rx="4"
                          className={`transition-all duration-200 fill-indigo-600 ${hoveredPoint?.index === index ? 'fill-indigo-500 filter drop-shadow-md' : 'opacity-85'}`} />
                        <text x={x + barWidth / 2} y={svgHeight - 12} textAnchor="middle"
                          className="text-[9px] font-bold text-slate-400 fill-current font-sans">
                          {d.shop_name.length > 8 ? d.shop_name.slice(0, 7) + '..' : d.shop_name}
                        </text>
                      </g>
                    );
                  });
                })()}
              </svg>

              {hoveredPoint && hoveredPoint.name && (
                <div
                  className="absolute bg-slate-900/95 backdrop-blur-md text-white rounded-xl p-3 shadow-xl border border-slate-700 pointer-events-none text-xs flex flex-col space-y-1 z-10"
                  style={{ left: `${(hoveredPoint.x / 600) * 100}%`, top: `${(hoveredPoint.y / 220) * 100 - 10}%`, transform: 'translate(-50%, -100%)' }}
                >
                  <span className="font-semibold text-slate-400">{hoveredPoint.name}</span>
                  <span className="font-extrabold text-white text-sm">
                    {chartType === 'revenue' ? `৳${parseFloat(hoveredPoint.val).toFixed(2)}` : `${hoveredPoint.val} Transactions`}
                  </span>
                  <span className="text-[10px] text-indigo-400 font-bold">{hoveredPoint.percent}% of total</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── 5. Data Table + Quick Links ───────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Tenant Table (span 2) */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Tenant Shops Breakdown</h3>
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="pb-3">#</th>
                    <th className="pb-3">Shop Name</th>
                    <th className="pb-3 text-center">Transactions</th>
                    <th className="pb-3 text-right">Gross Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-sm">
                  {tenantBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="py-8 text-center text-slate-400">No active shops recorded.</td>
                    </tr>
                  ) : (
                    tenantBreakdown.map((shop, index) => (
                      <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 text-slate-400 font-medium w-8">{index + 1}</td>
                        <td className="py-3.5 font-semibold text-slate-800">{shop.shop_name}</td>
                        <td className="py-3.5 text-center text-slate-600 font-medium">{shop.sales_count || 0}</td>
                        <td className="py-3.5 text-right font-extrabold text-indigo-600">
                          ৳{parseFloat(shop.shop_revenue || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Links Panel */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col">
            <h3 className="text-lg font-bold text-slate-800 mb-1">Administrator Panel</h3>
            <p className="text-xs text-slate-400 mb-5">Manage your platform components</p>

            <div className="space-y-3 flex-1">
              <button
                onClick={() => onNavigate('/shops')}
                className="w-full flex items-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-xl text-sm shadow transition-colors text-left"
              >
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <div>
                  <p>Manage Tenant Shops</p>
                  <p className="text-[11px] font-normal text-indigo-200">{metrics.total_shops} shops registered</p>
                </div>
              </button>

              <button
                onClick={() => onNavigate('/users')}
                className="w-full flex items-center gap-3 bg-slate-700 hover:bg-slate-800 text-white font-semibold py-3 px-4 rounded-xl text-sm shadow transition-colors text-left"
              >
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div>
                  <p>Manage System Users</p>
                  <p className="text-[11px] font-normal text-slate-400">{metrics.total_users} users in system</p>
                </div>
              </button>

              <button
                onClick={() => onNavigate('/products')}
                className="w-full flex items-center gap-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold py-3 px-4 rounded-xl text-sm shadow-xs transition-colors text-left"
              >
                <svg className="w-5 h-5 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <span>Global Inventory</span>
              </button>

              <button
                onClick={() => onNavigate('/total-revenue')}
                className="w-full flex items-center gap-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold py-3 px-4 rounded-xl text-sm shadow-xs transition-colors text-left"
              >
                <svg className="w-5 h-5 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <span>Revenue Reports</span>
              </button>

              <button
                onClick={() => onNavigate('/settings')}
                className="w-full flex items-center gap-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold py-3 px-4 rounded-xl text-sm shadow-xs transition-colors text-left"
              >
                <svg className="w-5 h-5 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>System Settings</span>
              </button>
            </div>
          </div>

        </div>

      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* 1. Header Row */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Shop Overview</h2>
        <p className="text-sm text-slate-500">Real-time performance indicators and inventory state</p>
      </div>

      {/* 2. Key Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

        {/* Total Revenue */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center space-x-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Gross Revenue</p>
            <h3 className="text-2xl font-extrabold text-slate-800 mt-0.5">৳{parseFloat(metrics.revenue).toFixed(2)}</h3>
          </div>
        </div>

        {/* Total Sales */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Sales Count</p>
            <h3 className="text-2xl font-extrabold text-slate-800 mt-0.5">{metrics.total_sales}</h3>
          </div>
        </div>

        {/* Low Stock Warning level */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center space-x-4">
          <div className={`p-3 rounded-xl ${metrics.low_stock_alerts > 0 ? 'bg-rose-50 text-rose-600 animate-pulse' : 'bg-slate-50 text-slate-400'}`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Low Stock Warnings</p>
            <h3 className={`text-2xl font-extrabold mt-0.5 ${metrics.low_stock_alerts > 0 ? 'text-rose-600' : 'text-slate-800'}`}>{metrics.low_stock_alerts}</h3>
          </div>
        </div>

        {/* Total Customers */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center space-x-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Customer Count</p>
            <h3 className="text-2xl font-extrabold text-slate-800 mt-0.5">{metrics.total_customers}</h3>
          </div>
        </div>

      </div>

      {/* Sales Performance Trend Chart */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs relative">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Sales Performance Trend</h3>
            <p className="text-xs text-slate-500">Daily business transaction volume and gross revenues over the last 7 days</p>
          </div>

          <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200/60 self-end sm:self-auto">
            <button
              onClick={() => setChartType('revenue')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${chartType === 'revenue'
                ? 'bg-white text-indigo-650 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              Revenue (৳)
            </button>
            <button
              onClick={() => setChartType('sales')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${chartType === 'sales'
                ? 'bg-white text-indigo-650 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              Transactions
            </button>
          </div>
        </div>

        {salesTrend.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
            No sales trend data available.
          </div>
        ) : (
          <div className="relative w-full h-[220px]">
            {/* SVG Plot */}
            <svg
              viewBox="0 0 600 220"
              className="w-full h-full overflow-visible"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="chartAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                const svgHeight = 220;
                const paddingTop = 20;
                const paddingBottom = 40;
                const paddingLeft = 55;
                const paddingRight = 25;
                const y = paddingTop + (1 - ratio) * (svgHeight - paddingTop - paddingBottom);
                const chartValues = salesTrend.map(d => chartType === 'revenue' ? parseFloat(d.revenue) : parseInt(d.sales_count));
                const maxVal = Math.max(...chartValues, 10);
                const labelVal = ratio * maxVal;

                return (
                  <g key={idx}>
                    <line
                      x1={paddingLeft}
                      y1={y}
                      x2={600 - paddingRight}
                      y2={y}
                      stroke="#f1f5f9"
                      strokeWidth="1.5"
                    />
                    <text
                      x={paddingLeft - 12}
                      y={y + 4}
                      textAnchor="end"
                      className="text-[10px] font-bold text-slate-400 fill-current font-sans"
                    >
                      {chartType === 'revenue' ? `৳${Math.round(labelVal)}` : Math.round(labelVal)}
                    </text>
                  </g>
                );
              })}

              {/* Paths and Dots */}
              {(() => {
                const svgWidth = 600;
                const svgHeight = 220;
                const paddingLeft = 55;
                const paddingRight = 25;
                const paddingTop = 20;
                const paddingBottom = 40;

                const chartValues = salesTrend.map(d => chartType === 'revenue' ? parseFloat(d.revenue) : parseInt(d.sales_count));
                const maxVal = Math.max(...chartValues, 10);

                const chartPoints = salesTrend.map((d, index) => {
                  const val = chartType === 'revenue' ? parseFloat(d.revenue) : parseInt(d.sales_count);
                  const x = paddingLeft + (index * (svgWidth - paddingLeft - paddingRight) / (salesTrend.length - 1 || 1));
                  const y = svgHeight - paddingBottom - ((val / maxVal) * (svgHeight - paddingTop - paddingBottom));
                  return { x, y, val, date: d.date };
                });

                const linePath = chartPoints.reduce((path, pt, i) => {
                  return path + (i === 0 ? `M ${pt.x} ${pt.y}` : ` L ${pt.x} ${pt.y}`);
                }, '');

                const areaPath = `${linePath} L ${chartPoints[chartPoints.length - 1].x} ${svgHeight - paddingBottom} L ${chartPoints[0].x} ${svgHeight - paddingBottom} Z`;

                return (
                  <>
                    {/* Area fill */}
                    <path d={areaPath} fill="url(#chartAreaGradient)" />

                    {/* Stroke line */}
                    <path
                      d={linePath}
                      fill="none"
                      stroke="#4f46e5"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* Interactive points */}
                    {chartPoints.map((pt, idx) => (
                      <g key={idx}>
                        {/* Large pointer catcher */}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r="18"
                          fill="transparent"
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredPoint({ ...pt, index: idx })}
                          onMouseLeave={() => setHoveredPoint(null)}
                        />
                        {/* Styled visual dot */}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={hoveredPoint?.index === idx ? "6" : "4.5"}
                          fill={hoveredPoint?.index === idx ? "#4f46e5" : "#ffffff"}
                          stroke="#4f46e5"
                          strokeWidth={hoveredPoint?.index === idx ? "3" : "2"}
                          className="pointer-events-none transition-all duration-150"
                        />
                      </g>
                    ))}

                    {/* X-Axis labels */}
                    {chartPoints.map((pt, idx) => {
                      const dateObj = new Date(pt.date);
                      const label = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      return (
                        <text
                          key={idx}
                          x={pt.x}
                          y={svgHeight - 12}
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

            {/* Tooltip Overlay */}
            {hoveredPoint && (
              <div
                className="absolute bg-slate-900/95 backdrop-blur-md text-white rounded-xl p-3 shadow-xl border border-slate-700 pointer-events-none text-xs flex flex-col space-y-1 transition-all duration-75 z-10"
                style={{
                  left: `${(hoveredPoint.x / 600) * 100}%`,
                  top: `${(hoveredPoint.y / 220) * 100 - 10}%`,
                  transform: 'translate(-50%, -100%)'
                }}
              >
                <span className="font-semibold text-slate-400">
                  {new Date(hoveredPoint.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
                <span className="font-extrabold text-white text-sm">
                  {chartType === 'revenue' ? `৳${parseFloat(hoveredPoint.val).toFixed(2)}` : `${hoveredPoint.val} Sales`}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Detailed Data Section */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Left Col: Recent Transactions (Span 2) */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Recent Transactions</h3>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="pb-3">Sale ID</th>
                  <th className="pb-3">Cashier</th>
                  <th className="pb-3">Payment</th>
                  <th className="pb-3">Date</th>
                  <th className="pb-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm">
                {recentSales.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-slate-400">
                      No transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  recentSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 font-semibold text-slate-600">#{sale.id}</td>
                      <td className="py-3.5 text-slate-700">{sale.staff_name}</td>
                      <td className="py-3.5">
                        <span className="capitalize px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-medium">
                          {sale.payment_method.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 text-slate-500">
                        {new Date(sale.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 text-right font-extrabold text-indigo-600">
                        ৳{parseFloat(sale.final_amount).toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Col: Charts & Actions (Span 2) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Payment Methods Donut Chart */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Sales by Payment Method</h3>
            {paymentBreakdown.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 items-center">
                {/* Donut Chart SVG */}
                <div className="relative w-full aspect-square">
                  <svg viewBox="0 0 36 36" className="w-full h-full">
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                    {(() => {
                      const totalValue = paymentBreakdown.reduce((sum, item) => sum + parseFloat(item.total), 0);
                      let accumulated = 0;
                      const colors = ['#eb2276ff', '#10b981', '#f59e0b', '#8b5cf6'];

                      return paymentBreakdown.map((item, index) => {
                        const percentage = (item.total / totalValue) * 100;
                        const strokeDasharray = `${percentage} ${100 - percentage}`;
                        const strokeDashoffset = 25 - accumulated;
                        accumulated += percentage;

                        return (
                          <circle
                            key={index}
                            cx="18"
                            cy="18"
                            r="15.915"
                            fill="none"
                            stroke={colors[index % colors.length]}
                            strokeWidth="3.2"
                            strokeDasharray={strokeDasharray}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                          />
                        );
                      });
                    })()}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xs text-slate-400 font-semibold">Total</span>
                    <span className="text-xl font-extrabold text-slate-800">৳{parseFloat(metrics.revenue).toFixed(0)}</span>
                  </div>
                </div>

                {/* Legend */}
                <div className="space-y-2.5 text-sm">
                  {(() => {
                    const colors = ['#4f46e5', '#10b981', '#f59e0b', '#8b5cf6'];
                    return paymentBreakdown.map((item, index) => (
                      <div key={index} className="flex items-center">
                        <span className="w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: colors[index % colors.length] }}></span>
                        <span className="font-semibold text-slate-700 capitalize">{item.payment_method.replace('_', ' ')}:</span>
                        <span className="ml-auto font-bold text-slate-500">{item.count}</span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center text-slate-400 text-sm">
                No payment data available.
              </div>
            )}
          </div>

          {/* Quick Actions & Inventory Alert */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-lg font-bold text-slate-800">Quick Inventory Status</h3>
            <div className="border border-slate-100 rounded-xl p-4 bg-slate-50 space-y-2">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Catalog Health</h4>
              <div className="flex justify-between items-center text-sm font-semibold">
                <span className="text-slate-600">Total Products listed:</span>
                <span className="text-slate-800">{metrics.total_products}</span>
              </div>
              <div className="flex justify-between items-center text-sm font-semibold">
                <span className="text-slate-600">Low stock alert count:</span>
                <span className={metrics.low_stock_alerts > 0 ? 'text-rose-600' : 'text-slate-800'}>
                  {metrics.low_stock_alerts}
                </span>
              </div>
            </div>

            <div className="space-y-2.5 pt-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quick Actions</h4>
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); onNavigate('/checkout'); }}
                className="w-full flex items-center justify-center space-x-2 bg-slate-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-4 rounded-xl text-sm shadow transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Launch POS Checkout</span>
              </a>
            </div>
          </div>
        </div>

      </div>

      {/* Product Performance Section */}
      {!isSuperAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Top Selling Products */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Top-Selling Products</h3>
                <p className="text-xs text-slate-500">Products with the highest sales volume</p>
              </div>
              <span className="bg-yellow-50 text-yellow-750 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-yellow-100 uppercase tracking-wider">
                Fast Moving
              </span>
            </div>

            <div className="flex-1">
              {topSelling.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-slate-400 text-sm bg-yellow-50/50 rounded-xl border border-dashed border-yellow-200">
                  <svg className="w-8 h-8 text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span>No sales data recorded yet.</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {topSelling.map((prod, idx) => {
                    const maxSold = topSelling[0]?.total_sold || 1;
                    const pct = (prod.total_sold / maxSold) * 100;

                    return (
                      <div key={prod.id} className="space-y-1">
                        <div className="flex justify-between text-sm font-semibold text-slate-800">
                          <div className="flex items-center space-x-2 truncate pr-4">
                            <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-650 text-[10px] font-extrabold flex items-center justify-center flex-shrink-0">
                              {idx + 1}
                            </span>
                            <span className="truncate text-slate-700 font-semibold" title={prod.name}>{prod.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">({prod.sku})</span>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className="font-bold text-slate-800">{prod.total_sold} {prod.unit || 'pcs'}</span>
                            <span className="text-[10px] text-slate-400 block font-normal">৳{parseFloat(prod.total_revenue).toFixed(2)}</span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Dead Stock / Unsold Items */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Dead Stock (Unsold Items)</h3>
                <p className="text-xs text-slate-500">Products with stock but no transaction sales</p>
              </div>
              <span className="bg-rose-50 text-rose-700 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-rose-100 uppercase tracking-wider">
                Unsold Stock
              </span>
            </div>

            <div className="flex-1">
              {deadStock.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-slate-400 text-sm bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                  <svg className="w-8 h-8 text-emerald-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>No dead stock found. All inventory is moving!</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                        <th className="p-2 pl-3">Product Name</th>
                        <th className="p-2">SKU</th>
                        <th className="p-2 text-center">Available Stock</th>
                        <th className="p-2 text-right">Unit Price</th>
                        <th className="p-2 text-right pr-3">Value Tied Up</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {deadStock.map((prod) => {
                        const tiedUpValue = prod.stock_quantity * parseFloat(prod.price);

                        return (
                          <tr key={prod.id} className="hover:bg-rose-50/20 transition-colors">
                            <td className="p-2.5 pl-3 font-semibold text-slate-700 max-w-[130px] truncate" title={prod.name}>
                              {prod.name}
                            </td>
                            <td className="p-2.5 text-slate-550 font-mono text-[10px]">{prod.sku}</td>
                            <td className="p-2.5 text-center font-bold text-slate-800">
                              {prod.stock_quantity} {prod.unit || 'pcs'}
                            </td>
                            <td className="p-2.5 text-right text-slate-600 font-medium">
                              ৳{parseFloat(prod.price).toFixed(2)}
                            </td>
                            <td className="p-2.5 text-right pr-3 font-extrabold text-rose-650">
                              ৳{tiedUpValue.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
