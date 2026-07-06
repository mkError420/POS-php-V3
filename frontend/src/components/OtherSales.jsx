import React, { useState, useEffect } from 'react';
import API_BASE_URL from '../config';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function OtherSales() {
  const userObj = JSON.parse(localStorage.getItem('user') || '{}');
  const isSuperAdmin = userObj.role === 'super_admin';

  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [alert, setAlert] = useState(null);
  const [shops, setShops] = useState([]);
  const [selectedShopId, setSelectedShopId] = useState('');
 
  // View Details Modal
  const [viewSale, setViewSale] = useState(null);
 
  // Form State
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    sale_date: new Date().toISOString().split('T')[0],
    notes: '',
    items: [ { category: 'Miscellaneous', item_name: '', quantity: 1, unit_price: '' } ]
  });
  
  const [submitting, setSubmitting] = useState(false);
 
  // Pagination & Filters for Recent History
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4;
 
  const fetchSales = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      let url = `${API_BASE_URL}/other-sales?`;
      if (isSuperAdmin && selectedShopId) {
        url += `shop_id=${selectedShopId}&`;
      }
      if (filterStartDate) url += `start_date=${filterStartDate}&`;
      if (filterEndDate) url += `end_date=${filterEndDate}&`;
 
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to retrieve sale records.');
      const data = await response.json();
      setSales(data);
      setCurrentPage(1);
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
    fetchSales();
  }, [selectedShopId]);

  const triggerAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 4000);
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    setFormData({ ...formData, items: newItems });
  };

  const addItem = (defaultCategory = 'Miscellaneous', defaultName = '') => {
    setFormData({
      ...formData,
      items: [...formData.items, { category: defaultCategory, item_name: defaultName, quantity: 1, unit_price: '' }]
    });
  };

  const handleQuickCategoryClick = (category, defaultName) => {
    // If the first item is completely empty, replace it
    if (formData.items.length === 1 && !formData.items[0].item_name && !formData.items[0].unit_price) {
      const newItems = [...formData.items];
      newItems[0].category = category;
      newItems[0].item_name = defaultName;
      setFormData({ ...formData, items: newItems });
    } else {
      // Otherwise add a new item
      addItem(category, defaultName);
    }
  };

  const removeItem = (index) => {
    if (formData.items.length === 1) return;
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  };

  const formatCurrencyPDF = (val) => {
    const numericVal = parseFloat(val || 0);
    return `Tk ${numericVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text('Other Sales History', 14, 15);
    
    if (filterStartDate || filterEndDate) {
      doc.setFontSize(10);
      doc.text(`Date Range: ${filterStartDate || '...'} to ${filterEndDate || '...'}`, 14, 22);
    }
    
    const tableData = sales.map(sale => {
       const items = parseItems(sale.items).map(i => `${i.item_name} (${i.category})`).join(', ');
       return [
         formatDate(sale.sale_date),
         sale.title || 'Other Sale',
         sale.customer_name || 'Walk-in',
         formatCurrencyPDF(sale.amount),
         items
       ];
    });

    autoTable(doc, {
      head: [['Date', 'Title', 'Customer', 'Amount', 'Items']],
      body: tableData,
      startY: (filterStartDate || filterEndDate) ? 28 : 22,
      styles: { fontSize: 8 },
    });
    
    doc.save('OtherSales_History.pdf');
  };

  const calculateGrandTotal = () => {
    return formData.items.reduce((total, item) => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unit_price) || 0;
      return total + (item.category === 'Mobile Banking Services' ? price : (qty * price));
    }, 0);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!formData.sale_date) {
      triggerAlert('error', 'Please provide a sale date.');
      return;
    }
    
    // Validate items
    const validItems = formData.items.filter(i => i.item_name.trim() !== '' && parseFloat(i.unit_price) > 0);
    if (validItems.length === 0) {
      triggerAlert('error', 'Please add at least one valid item with a price.');
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/other-sales`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          customer_name: formData.customer_name,
          customer_phone: formData.customer_phone,
          sale_date: formData.sale_date,
          notes: formData.notes,
          items: validItems
        })
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to record sale entry.');

      triggerAlert('success', 'Sale entry recorded successfully!');
      resetForm();
      fetchSales();
    } catch (err) {
      triggerAlert('error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (saleId) => {
    if (!window.confirm('Are you sure you want to delete this sale record?')) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/other-sales/${saleId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to delete sale record.');

      triggerAlert('success', 'Sale record deleted successfully!');
      if (viewSale && viewSale.id === saleId) setViewSale(null);
      fetchSales();
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  const resetForm = () => {
    setFormData({
      customer_name: '',
      customer_phone: '',
      sale_date: new Date().toISOString().split('T')[0],
      notes: '',
      items: [ { category: 'Miscellaneous', item_name: '', quantity: 1, unit_price: '' } ]
    });
  };

  const formatCurrency = (val) => `৳${parseFloat(val).toFixed(2)}`;
  
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      return new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric'
      });
    }
    return new Date(dateStr).toLocaleDateString();
  };

  const parseItems = (itemsStr) => {
    if (!itemsStr) return [];
    if (Array.isArray(itemsStr)) return itemsStr;
    if (typeof itemsStr === 'object') return [itemsStr];
    try {
      return JSON.parse(itemsStr);
    } catch (e) {
      return [];
    }
  };

  const CATEGORIES = [
    'Wastage / Scrap',
    'Mobile Banking Services',
    'Miscellaneous'
  ];

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
          <h2 className="text-2xl font-bold text-slate-800">Other Sales</h2>
          <p className="text-sm text-slate-500">Record sales of miscellaneous goods, scrap, or services</p>
        </div>
        {isSuperAdmin && (
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tenant Shop:</span>
            <select
              value={selectedShopId}
              onChange={(e) => setSelectedShopId(e.target.value)}
              className="border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 outline-none text-slate-700 font-medium text-sm bg-white"
            >
              <option value="">All Shops</option>
              {shops.map((shop) => (
                <option key={shop.id} value={shop.id}>{shop.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>
 
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: Entry Form */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Quick Category Shortcuts */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">Quick Entry Shortcuts</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button
                type="button"
                onClick={() => handleQuickCategoryClick('Wastage / Scrap', 'Scrap/Wastage: ')}
                className="flex flex-col items-start p-4 bg-gradient-to-br from-orange-50 to-orange-100/50 border border-orange-200 rounded-2xl hover:shadow-md hover:border-orange-300 transition-all text-left"
              >
                <div className="bg-orange-100 text-orange-600 p-2 rounded-lg mb-3">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <span className="font-bold text-slate-800">Wastage / Scrap</span>
                <span className="text-xs text-slate-500 mt-1">Paper, Hardboard, Plastic</span>
              </button>
              
              <button
                type="button"
                onClick={() => handleQuickCategoryClick('Mobile Banking Services', 'Cash-In/Out: ')}
                className="flex flex-col items-start p-4 bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200 rounded-2xl hover:shadow-md hover:border-blue-300 transition-all text-left"
              >
                <div className="bg-blue-100 text-blue-600 p-2 rounded-lg mb-3">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className="font-bold text-slate-800">Mobile Banking</span>
                <span className="text-xs text-slate-500 mt-1">bKash, Nagad, Recharge</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickCategoryClick('Miscellaneous', '')}
                className="flex flex-col items-start p-4 bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200 rounded-2xl hover:shadow-md hover:border-emerald-300 transition-all text-left"
              >
                <div className="bg-emerald-100 text-emerald-600 p-2 rounded-lg mb-3">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <span className="font-bold text-slate-800">Miscellaneous</span>
                <span className="text-xs text-slate-500 mt-1">Pallets, Bags, Fees</span>
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center border-b border-slate-100 pb-3">
              <svg className="w-5 h-5 mr-2 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Quick Entry Form
            </h3>

            <form onSubmit={handleAddSubmit} className="space-y-5">
              {/* Customer & Date */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Customer Name</label>
                    <input
                      type="text"
                      name="customer_name"
                      value={formData.customer_name}
                      onChange={handleInputChange}
                      placeholder="Optional"
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-emerald-500 outline-none bg-slate-50/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Phone</label>
                    <input
                      type="text"
                      name="customer_phone"
                      value={formData.customer_phone}
                      onChange={handleInputChange}
                      placeholder="Optional"
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-emerald-500 outline-none bg-slate-50/50"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Sale Date *</label>
                  <input
                    type="date"
                    name="sale_date"
                    value={formData.sale_date}
                    onChange={handleInputChange}
                    required
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-emerald-500 outline-none bg-slate-50/50"
                  />
                </div>
              </div>

              {/* Line Items */}
              <div className="pt-4 border-t border-slate-100">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-sm font-bold text-slate-700">Items / Services</h4>
                </div>
                
                <div className="space-y-4">
                  {formData.items.map((item, index) => (
                    <div key={index} className="flex flex-col gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative">
                      {formData.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Remove Item"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Sale Category</label>
                          <select
                            value={item.category}
                            onChange={(e) => handleItemChange(index, 'category', e.target.value)}
                            className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-emerald-500 outline-none font-medium bg-slate-50"
                          >
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Item / Description</label>
                          <input
                            type="text"
                            value={item.item_name}
                            onChange={(e) => handleItemChange(index, 'item_name', e.target.value)}
                            placeholder='e.g., "50kg Old Cartons" or "Mobile Cash-In Fee"'
                            required
                            className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-emerald-500 outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            {item.category === 'Mobile Banking Services' ? 'Transaction Amount' : 'Quantity / Weight'}
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                              required
                              className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-emerald-500 outline-none pr-8"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">
                              {item.category === 'Mobile Banking Services' ? '৳' : 'qty/kg'}
                            </span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            {item.category === 'Mobile Banking Services' ? 'Commission / Fee (Profit)' : 'Unit Price / Amount (৳)'}
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unit_price}
                            onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                            required
                            placeholder={item.category === 'Mobile Banking Services' ? 'Fee (Profit)' : 'Price'}
                            className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-emerald-500 outline-none"
                          />
                        </div>
                        <div className="col-span-2 md:col-span-2 flex items-center justify-end bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-3">Item Subtotal (Profit):</span>
                          <span className="font-black text-emerald-600 text-lg">
                            {formatCurrency(
                              item.category === 'Mobile Banking Services' 
                                ? (parseFloat(item.unit_price) || 0) 
                                : ((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0))
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => addItem()}
                    className="text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center space-x-1 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Add Another Row</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Notes / Reference</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    rows="3"
                    placeholder="Payment receipt ref, paid by cash, etc."
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-emerald-500 outline-none bg-slate-50/50"
                  />
                </div>
                <div className="flex flex-col justify-end items-end space-y-3 bg-gradient-to-br from-emerald-50 to-emerald-100/30 p-5 rounded-2xl border border-emerald-100">
                  <div className="flex justify-between w-full text-emerald-800/70 text-sm">
                    <span className="font-semibold uppercase tracking-wider">
                      {formData.items.every(i => i.category === 'Mobile Banking Services') ? 'Total Transactions:' : 'Total Items/Rows:'}
                    </span>
                    <span className="font-bold">{formData.items.length}</span>
                  </div>
                  <div className="w-full h-px bg-emerald-200/50"></div>
                  <div className="flex justify-between items-center w-full text-emerald-800">
                    <span className="font-black text-sm uppercase tracking-wider">Grand Total:</span>
                    <span className="font-black text-2xl drop-shadow-sm">{formatCurrency(calculateGrandTotal())}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 hover:text-slate-800 transition-colors mr-3"
                >
                  Clear Form
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-8 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-black tracking-wide transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {submitting ? 'Processing...' : 'Complete Sale'}
                  {!submitting && (
                    <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: Recent Sales */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[600px] lg:sticky lg:top-6">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Recent History</h3>
                <div className="flex items-center space-x-2">
                  <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-lg">
                    {sales.length}
                  </span>
                  <button onClick={exportPDF} className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1 px-2.5 rounded-lg transition-colors flex items-center shadow-sm">
                    PDF Export
                  </button>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input 
                  type="date" 
                  value={filterStartDate} 
                  onChange={(e) => setFilterStartDate(e.target.value)} 
                  className="border border-slate-200 rounded-lg p-1.5 text-xs focus:ring-1 focus:ring-emerald-500 outline-none w-full"
                />
                <input 
                  type="date" 
                  value={filterEndDate} 
                  onChange={(e) => setFilterEndDate(e.target.value)} 
                  className="border border-slate-200 rounded-lg p-1.5 text-xs focus:ring-1 focus:ring-emerald-500 outline-none w-full"
                />
                <button 
                  onClick={() => fetchSales()} 
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors"
                >
                  Filter
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3">
              {loading ? (
                <div className="p-8 text-center text-slate-500 text-sm font-medium">Loading history...</div>
              ) : sales.length === 0 ? (
                <div className="p-8 text-center flex flex-col items-center justify-center text-slate-400">
                  <svg className="w-12 h-12 mb-3 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm font-medium">No recent entries found.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(() => {
                    const totalPages = Math.ceil(sales.length / itemsPerPage) || 1;
                    const currentSales = sales.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
                    return currentSales.map(sale => (
                      <div 
                        key={sale.id} 
                        onClick={() => setViewSale(sale)}
                        className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-sm hover:shadow-md hover:border-emerald-300 cursor-pointer transition-all flex flex-col group"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{formatDate(sale.sale_date)}</span>
                          <span className="text-sm font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">{formatCurrency(sale.amount)}</span>
                        </div>
                        <div className="text-sm font-bold text-slate-800 leading-tight">
                          {sale.title || 'Custom Sale'}
                        </div>
                        <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-100">
                          <span className="text-xs font-medium text-slate-500 truncate max-w-[150px] flex items-center">
                            <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            {sale.customer_name || 'Walk-in'}
                          </span>
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-2.5 py-1 rounded-md font-bold uppercase tracking-wider group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                            Details
                          </span>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>
            
            {sales.length > 0 && (
              <div className="p-3 border-t border-slate-100 bg-slate-50 flex justify-between items-center text-xs font-bold text-slate-500 mt-auto">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-50 transition-colors"
                >
                  Prev
                </button>
                <span>Page {currentPage} of {Math.ceil(sales.length / itemsPerPage) || 1}</span>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(sales.length / itemsPerPage) || 1, p + 1))}
                  disabled={currentPage === (Math.ceil(sales.length / itemsPerPage) || 1)}
                  className="px-3 py-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-50 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* VIEW SALE MODAL */}
      {viewSale && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50">
              <h3 className="text-lg font-black text-slate-800 flex items-center">
                <svg className="w-5 h-5 mr-2 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Sale Details <span className="ml-2 text-sm font-semibold text-slate-400 font-mono">#{viewSale.id}</span>
              </h3>
              <button onClick={() => setViewSale(null)} className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Date</div>
                  <div className="font-bold text-slate-700">{formatDate(viewSale.sale_date)}</div>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 md:col-span-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Customer</div>
                  <div className="font-bold text-slate-700">{viewSale.customer_name || 'Walk-in'}</div>
                  {viewSale.customer_phone && <div className="text-sm font-medium text-slate-500 mt-0.5">{viewSale.customer_phone}</div>}
                </div>
                {isSuperAdmin && (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 col-span-2 md:col-span-3">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tenant Shop</div>
                    <div className="font-bold text-slate-700">{viewSale.shop_name}</div>
                  </div>
                )}
              </div>

              <h4 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wider">Itemized Breakdown</h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden mb-6 shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Category / Item</th>
                      <th className="px-4 py-3 text-center">Qty</th>
                      <th className="px-4 py-3 text-right">Unit Price</th>
                      <th className="px-4 py-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {parseItems(viewSale.items).map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-700">{item.item_name}</div>
                          {item.category && <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">{item.category}</div>}
                        </td>
                        <td className="px-4 py-3 text-center font-medium text-slate-600">
                          {item.quantity}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-600">
                          {formatCurrency(item.unit_price)}
                        </td>
                        <td className="px-4 py-3 text-right font-black text-slate-800">
                          {formatCurrency(item.subtotal || (item.quantity * item.unit_price))}
                        </td>
                      </tr>
                    ))}
                    {parseItems(viewSale.items).length === 0 && (
                      <tr>
                        <td colSpan="4" className="px-4 py-6 text-center text-slate-400 text-sm font-medium">
                          No itemized details for this legacy record.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="bg-emerald-50/50 border-t-2 border-emerald-100">
                    <tr>
                      <td colSpan="3" className="px-4 py-4 text-right font-bold text-emerald-800 uppercase text-xs tracking-wider">Total Amount:</td>
                      <td className="px-4 py-4 text-right font-black text-emerald-600 text-xl">{formatCurrency(viewSale.amount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {viewSale.notes && (
                <div className="bg-amber-50/50 text-amber-800 p-4 rounded-xl text-sm border border-amber-100/50 shadow-sm">
                  <span className="font-bold uppercase text-[10px] tracking-wider block mb-1.5 opacity-70">Notes / Reference</span>
                  <p className="font-medium">{viewSale.notes}</p>
                </div>
              )}
            </div>

            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
              <button
                onClick={() => handleDelete(viewSale.id)}
                className="px-4 py-2.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl text-sm font-bold transition-colors flex items-center space-x-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>Delete</span>
              </button>
              <button
                onClick={() => setViewSale(null)}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

