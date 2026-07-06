import React, { useState, useEffect } from 'react';
import API_BASE_URL from '../config';

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
    items: [ { item_name: '', quantity: 1, unit_price: '' } ]
  });
  
  const [submitting, setSubmitting] = useState(false);
 
  const fetchSales = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      let url = `${API_BASE_URL}/other-sales?`;
      if (isSuperAdmin && selectedShopId) {
        url += `shop_id=${selectedShopId}&`;
      }
 
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to retrieve sale records.');
      const data = await response.json();
      setSales(data);
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

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { item_name: '', quantity: 1, unit_price: '' }]
    });
  };

  const removeItem = (index) => {
    if (formData.items.length === 1) return;
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  };

  const calculateGrandTotal = () => {
    return formData.items.reduce((total, item) => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unit_price) || 0;
      return total + (qty * price);
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
      items: [ { item_name: '', quantity: 1, unit_price: '' } ]
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
    try {
      return JSON.parse(itemsStr);
    } catch (e) {
      return [];
    }
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
          <h2 className="text-2xl font-bold text-slate-800">Other Sales Form</h2>
          <p className="text-sm text-slate-500">Record sales of miscellaneous goods (Papers, Hardboard, etc.)</p>
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
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center border-b border-slate-100 pb-3">
              <svg className="w-5 h-5 mr-2 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              New Sale Invoice
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
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-emerald-500 outline-none"
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
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-emerald-500 outline-none"
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
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              {/* Line Items */}
              <div className="pt-4 border-t border-slate-100">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-sm font-bold text-slate-700">Line Items</h4>
                </div>
                
                <div className="space-y-3">
                  {formData.items.map((item, index) => (
                    <div key={index} className="flex flex-col md:flex-row gap-3 items-start md:items-center bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                      <div className="flex-1 w-full">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 md:hidden">Item Name</label>
                        <input
                          type="text"
                          value={item.item_name}
                          onChange={(e) => handleItemChange(index, 'item_name', e.target.value)}
                          placeholder="e.g. Papers, Hardboard"
                          required
                          className="w-full border border-slate-200 rounded-lg p-2 text-sm focus:ring-1 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                      <div className="w-full md:w-24">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 md:hidden">Qty</label>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                          required
                          className="w-full border border-slate-200 rounded-lg p-2 text-sm focus:ring-1 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                      <div className="w-full md:w-32">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 md:hidden">Unit Price (৳)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                          required
                          placeholder="Price"
                          className="w-full border border-slate-200 rounded-lg p-2 text-sm focus:ring-1 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                      <div className="w-full md:w-24 flex items-center justify-between md:justify-center">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider md:hidden">Subtotal:</span>
                        <span className="font-bold text-slate-700 text-sm">
                          {formatCurrency((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0))}
                        </span>
                      </div>
                      <div className="w-full md:w-auto flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          disabled={formData.items.length === 1}
                          className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3">
                  <button
                    type="button"
                    onClick={addItem}
                    className="text-emerald-600 hover:text-emerald-800 text-sm font-semibold flex items-center space-x-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Add Another Item</span>
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
                    rows="2"
                    placeholder="Payment receipt ref, paid by cash, etc."
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-emerald-500 outline-none bg-white"
                  />
                </div>
                <div className="flex flex-col justify-end items-end space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex justify-between w-full text-slate-600">
                    <span className="font-semibold">Items Count:</span>
                    <span className="font-bold">{formData.items.length}</span>
                  </div>
                  <div className="flex justify-between w-full text-emerald-700 text-lg">
                    <span className="font-bold uppercase">Grand Total:</span>
                    <span className="font-black">{formatCurrency(calculateGrandTotal())}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors mr-3"
                >
                  Reset Form
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {submitting ? 'Saving...' : 'Finalize Sale'}
                  {!submitting && (
                    <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: Recent Sales */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[600px]">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Recent Sales History</h3>
              <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-1 rounded-lg">
                {sales.length}
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2">
              {loading ? (
                <div className="p-8 text-center text-slate-500">Loading history...</div>
              ) : sales.length === 0 ? (
                <div className="p-8 text-center flex flex-col items-center justify-center text-slate-400">
                  <svg className="w-12 h-12 mb-3 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p>No recent sales found.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sales.map(sale => (
                    <div 
                      key={sale.id} 
                      onClick={() => setViewSale(sale)}
                      className="bg-white border border-slate-100 p-3 rounded-xl shadow-xs hover:shadow-md hover:border-emerald-200 cursor-pointer transition-all flex flex-col group"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-bold text-slate-500">{formatDate(sale.sale_date)}</span>
                        <span className="text-sm font-black text-emerald-600">{formatCurrency(sale.amount)}</span>
                      </div>
                      <div className="text-sm font-semibold text-slate-800 truncate">
                        {sale.title || 'Custom Sale'}
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-xs text-slate-500 truncate max-w-[150px]">
                          {sale.customer_name ? `Cust: ${sale.customer_name}` : 'Walk-in Customer'}
                        </span>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold uppercase group-hover:bg-emerald-100 group-hover:text-emerald-700 transition-colors">
                          View Details
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* VIEW SALE MODAL */}
      {viewSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800 flex items-center">
                <svg className="w-5 h-5 mr-2 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Sale Details (ID: #{viewSale.id})
              </h3>
              <button onClick={() => setViewSale(null)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Date</div>
                  <div className="font-semibold text-slate-700">{formatDate(viewSale.sale_date)}</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Customer</div>
                  <div className="font-semibold text-slate-700">{viewSale.customer_name || 'Walk-in'}</div>
                  {viewSale.customer_phone && <div className="text-xs text-slate-500">{viewSale.customer_phone}</div>}
                </div>
                {isSuperAdmin && (
                  <div className="col-span-2">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Shop</div>
                    <div className="font-semibold text-slate-700">{viewSale.shop_name}</div>
                  </div>
                )}
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden mb-6">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2">Item</th>
                      <th className="px-4 py-2 text-center">Qty</th>
                      <th className="px-4 py-2 text-right">Price</th>
                      <th className="px-4 py-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parseItems(viewSale.items).map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-700">{item.item_name}</td>
                        <td className="px-4 py-3 text-center">{item.quantity}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(item.unit_price)}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(item.subtotal || (item.quantity * item.unit_price))}</td>
                      </tr>
                    ))}
                    {parseItems(viewSale.items).length === 0 && (
                      <tr>
                        <td colSpan="4" className="px-4 py-4 text-center text-slate-500 italic text-xs">
                          No itemized details for this legacy record.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t border-slate-200">
                    <tr>
                      <td colSpan="3" className="px-4 py-3 text-right font-bold text-slate-600 uppercase text-xs tracking-wider">Total Amount:</td>
                      <td className="px-4 py-3 text-right font-black text-emerald-600 text-base">{formatCurrency(viewSale.amount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {viewSale.notes && (
                <div className="bg-amber-50 text-amber-800 p-3 rounded-xl text-sm border border-amber-100">
                  <span className="font-bold block mb-1">Notes:</span>
                  {viewSale.notes}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between">
              <button
                onClick={() => handleDelete(viewSale.id)}
                className="px-4 py-2 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl text-sm font-bold transition-colors flex items-center space-x-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>Delete Record</span>
              </button>
              <button
                onClick={() => setViewSale(null)}
                className="px-5 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-xl text-sm font-bold transition-colors shadow-sm"
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
