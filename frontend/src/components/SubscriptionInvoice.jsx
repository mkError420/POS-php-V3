import React from 'react';

export default function SubscriptionInvoice({ isOpen, onClose, invoice }) {
  if (!isOpen || !invoice) return null;

  const handlePrint = () => {
    window.print();
  };

  const invoiceNumber = `SUB-${invoice.id || 'PENDING'}-${Math.floor(1000 + Math.random() * 9000)}`;
  const issueDate = invoice.created_at ? new Date(invoice.created_at).toLocaleDateString() : new Date().toLocaleDateString();

  const printStyle = `
    @media print {
      body * {
        visibility: hidden !important;
      }
      #print-invoice-area, #print-invoice-area * {
        visibility: visible !important;
      }
      #print-invoice-area {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        margin: 0;
        padding: 24px;
        background: white !important;
        color: black !important;
      }
      .no-print {
        display: none !important;
      }
    }
  `;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm no-print">
      <style>{printStyle}</style>
      
      <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Actions bar (hidden in print) */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center no-print">
          <h3 className="text-sm font-bold text-slate-800">Subscription Invoice Slip</h3>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-xl text-xs shadow-md transition-all active:translate-y-0.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print Invoice
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-205 text-xs font-semibold text-slate-650 hover:bg-slate-100 transition-colors"
            >
              Close
            </button>
          </div>
        </div>

        {/* Printable Invoice Sheet */}
        <div id="print-invoice-area" className="p-8 overflow-y-auto bg-white text-slate-800 space-y-8 flex-1">
          {/* Invoice Header */}
          <div className="flex justify-between items-start border-b border-slate-100 pb-6">
            <div>
              <div className="text-xl font-extrabold tracking-tight text-slate-900 uppercase">Codexaa-POS System</div>
              <p className="text-xs text-slate-400 mt-1">Multi-Tenant Store Subscription Service</p>
              <p className="text-[11px] text-slate-500 mt-2">support@codexaapos.com · www.codexaapos.com</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-slate-300 tracking-wider uppercase">Invoice</div>
              <div className="text-xs font-mono font-bold text-slate-700 mt-1">{invoiceNumber}</div>
              <div className="text-xs text-slate-400 mt-1">Date: {issueDate}</div>
            </div>
          </div>

          {/* Client & Billing Details */}
          <div className="grid grid-cols-2 gap-6 text-xs">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Billed To (Tenant Store)</div>
              <div className="font-bold text-slate-900 text-sm">{invoice.name}</div>
              <div className="text-slate-600 mt-1">Email: {invoice.email}</div>
              <div className="text-slate-605">Phone: {invoice.phone || 'N/A'}</div>
              <div className="text-slate-605">Address: {invoice.address || 'N/A'}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Payment Method details</div>
              <div className="font-bold text-slate-850 uppercase text-xs bg-slate-100 border border-slate-200 px-2 py-0.5 rounded inline-block">
                {invoice.payment_method ? invoice.payment_method.replace('_', ' ') : 'Manual Payment'}
              </div>
              <div className="text-slate-600 mt-2 font-mono">
                <span className="text-slate-400 font-sans">TRX ID:</span> {invoice.transaction_id || 'N/A'}
              </div>
              <div className="mt-2.5">
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                  invoice.status === 'approved' || invoice.status === 'active'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                    : 'bg-amber-50 text-amber-600 border-amber-100'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${invoice.status === 'approved' || invoice.status === 'active' ? 'bg-emerald-550' : 'bg-amber-450'}`} />
                  {invoice.status === 'approved' || invoice.status === 'active' ? 'PAID / ACTIVE' : 'PENDING APPROVAL'}
                </span>
              </div>
            </div>
          </div>

          {/* Subscription Package Item Table */}
          <div className="border border-slate-100 rounded-2xl overflow-hidden mt-6">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                  <th className="px-5 py-3">Description</th>
                  <th className="px-5 py-3 text-center">Duration</th>
                  <th className="px-5 py-3 text-right">Price</th>
                  <th className="px-5 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="text-xs text-slate-700 divide-y divide-slate-50">
                <tr>
                  <td className="px-5 py-4">
                    <div className="font-bold text-slate-900">Subscription Store Setup Fee</div>
                    <div className="text-slate-400 text-[10px] mt-0.5">Package Plan: {invoice.package_name || 'Starter Plan'}</div>
                  </td>
                  <td className="px-5 py-4 text-center">{invoice.duration_days || 30} Days</td>
                  <td className="px-5 py-4 text-right font-mono font-semibold">{parseFloat(invoice.price || 0).toFixed(2)} T.K</td>
                  <td className="px-5 py-4 text-right font-mono font-bold text-slate-900">{parseFloat(invoice.price || 0).toFixed(2)} T.K</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Pricing Totals */}
          <div className="flex justify-end pt-4">
            <div className="w-64 space-y-2 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span className="font-mono">{parseFloat(invoice.price || 0).toFixed(2)} T.K</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Tax (0%)</span>
                <span className="font-mono">0.00 T.K</span>
              </div>
              <div className="flex justify-between border-t border-slate-150 pt-2 font-bold text-slate-900 text-sm">
                <span>Grand Total</span>
                <span className="font-mono text-indigo-650">{parseFloat(invoice.price || 0).toFixed(2)} T.K</span>
              </div>
            </div>
          </div>

          {/* Invoice Note */}
          <div className="border-t border-slate-100 pt-6 text-[10px] text-slate-450 space-y-1.5 text-center leading-relaxed">
            <p className="font-semibold text-slate-600">Important Terms & Service Notes</p>
            <p>Your subscription is currently awaiting Super Admin approval. Once payment is confirmed manually via the submitted Transaction ID, your storefront will be activated instantly. A backup of your store can be requested via the admin center at any time.</p>
            <p className="text-[9px] text-slate-350 mt-3 font-mono">Thank you for subscribing to Codexaa-POS. Generated automatically by Codexaa Billing Engine.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
