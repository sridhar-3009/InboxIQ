import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Loader2, Lock, ShoppingBag } from 'lucide-react';
import toast from 'react-hot-toast';
import ShopLayout from '@/components/ShopLayout';
import { useCart } from '@/lib/cart';
import { shopApi } from '@/lib/api';
import { apiErrorMessage } from '@/lib/apiError';

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open(): void };
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-primary-500 transition-colors";

const FIELD_LABELS: Record<string, string> = {
  name: 'Full Name', email: 'Email', phone: 'Phone',
  line1: 'Address Line 1', city: 'City', state: 'State', pincode: 'Pincode',
};

export default function CheckoutPage() {
  const router = useRouter();
  const { items, totalPaise, clearCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', phone: '',
    line1: '', line2: '', city: '', state: '', pincode: '',
    notes: '',
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const validate = () => {
    const required = ['name', 'email', 'phone', 'line1', 'city', 'state', 'pincode'] as const;
    for (const f of required) {
      if (!form[f].trim()) {
        toast.error(`${FIELD_LABELS[f]} is required`);
        return false;
      }
    }
    if (!/\S+@\S+\.\S+/.test(form.email)) { toast.error('Please enter a valid email address'); return false; }
    if (!/^\d{10}$/.test(form.phone)) { toast.error('Phone number must be 10 digits'); return false; }
    if (!/^\d{6}$/.test(form.pincode)) { toast.error('Pincode must be 6 digits'); return false; }
    return true;
  };

  const handleCheckout = async () => {
    if (!validate()) return;
    if (items.length === 0) { toast.error('Your cart is empty'); return; }
    setLoading(true);
    try {
      const orderRes = await shopApi.createOrder({
        items: items.map(i => ({ product_id: i.product_id, variant: i.variant, quantity: i.quantity, unit_price: i.unit_price, customization: i.customization })),
        shipping: { name: form.name, email: form.email, phone: form.phone, line1: form.line1, line2: form.line2 || undefined, city: form.city, state: form.state, pincode: form.pincode },
        notes: form.notes || undefined,
      });

      if (!window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://checkout.razorpay.com/v1/checkout.js';
          s.onload = () => resolve();
          s.onerror = () => reject(new Error('Could not load payment gateway. Check your connection and try again.'));
          document.head.appendChild(s);
        });
      }

      const rz = new window.Razorpay({
        key: orderRes.key,
        amount: orderRes.amount,
        currency: orderRes.currency,
        name: 'Mailair Shop',
        description: `Order #${orderRes.order_id?.slice(0, 8).toUpperCase()}`,
        order_id: orderRes.razorpay_order_id,
        prefill: { name: orderRes.customer_name, email: orderRes.customer_email, contact: orderRes.customer_phone },
        theme: { color: '#b04723' },
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          try {
            await shopApi.verifyPayment({
              order_id: orderRes.order_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            clearCart();
            router.push(`/shop/orders/${orderRes.order_id}?email=${encodeURIComponent(form.email)}`);
          } catch (err) {
            toast.error(
              'Payment was received but confirmation failed. Please email support@mailair.company with your order ID: ' +
              orderRes.order_id?.slice(0, 8).toUpperCase(),
              { duration: 8000 }
            );
            console.error('Payment verification error:', err);
          }
        },
        modal: { ondismiss: () => setLoading(false) },
      });
      rz.open();
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err));
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <ShopLayout title="Checkout">
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 border border-gray-200 mb-4">
            <ShoppingBag className="h-7 w-7 text-gray-500" />
          </div>
          <p className="text-gray-900 font-semibold text-lg mb-1">Your cart is empty</p>
          <p className="text-gray-500 text-sm mb-6">Add some Mailair goodies before checking out.</p>
          <Link href="/shop" className="bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl px-6 py-3 transition-colors text-sm">
            Browse Shop
          </Link>
        </div>
      </ShopLayout>
    );
  }

  return (
    <ShopLayout title="Checkout">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-serif text-2xl text-gray-900 mb-8">Checkout</h1>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Form */}
          <div className="lg:col-span-3 space-y-5">
            <div className="bg-white border border-gray-200 shadow-warm rounded-2xl p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-700">Shipping Details</h2>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Full Name">
                  <input value={form.name} onChange={set('name')} placeholder="Ravi Kumar" className={inputCls} />
                </Field>
                <Field label="Email">
                  <input type="email" value={form.email} onChange={set('email')} placeholder="ravi@example.com" className={inputCls} />
                </Field>
                <Field label="Phone (10 digits)">
                  <input value={form.phone} onChange={set('phone')} placeholder="9876543210" maxLength={10} className={inputCls} />
                </Field>
              </div>
              <Field label="Address Line 1">
                <input value={form.line1} onChange={set('line1')} placeholder="123, MG Road" className={inputCls} />
              </Field>
              <Field label="Address Line 2 (optional)">
                <input value={form.line2} onChange={set('line2')} placeholder="Apartment, suite, etc." className={inputCls} />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="City">
                  <input value={form.city} onChange={set('city')} placeholder="Bengaluru" className={inputCls} />
                </Field>
                <Field label="State">
                  <input value={form.state} onChange={set('state')} placeholder="Karnataka" className={inputCls} />
                </Field>
                <Field label="Pincode (6 digits)">
                  <input value={form.pincode} onChange={set('pincode')} placeholder="560001" maxLength={6} className={inputCls} />
                </Field>
              </div>
              <Field label="Order Notes (optional)">
                <textarea value={form.notes} onChange={set('notes')} rows={2} placeholder="Anything special?" className={`${inputCls} resize-none`} />
              </Field>
            </div>
          </div>

          {/* Summary */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white border border-gray-200 shadow-warm rounded-2xl p-5 space-y-3 sticky top-24">
              <h2 className="text-sm font-semibold text-gray-700">Order Summary</h2>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {items.map((item, i) => (
                  <div key={i} className="flex justify-between text-xs text-gray-500">
                    <span className="truncate pr-2">{item.product_name}{item.variant ? ` (${item.variant})` : ''} ×{item.quantity}</span>
                    <span className="flex-shrink-0 text-gray-900">₹{(item.unit_price * item.quantity / 100).toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-200 pt-3 flex justify-between">
                <span className="font-semibold text-gray-900 text-sm">Total</span>
                <span className="text-lg font-bold text-primary-700">₹{(totalPaise / 100).toLocaleString('en-IN')}</span>
              </div>
              <button
                onClick={handleCheckout}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 transition-colors">
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Processing…</> : <><Lock className="h-4 w-4" />Pay Securely</>}
              </button>
              <p className="text-xs text-gray-400 text-center">Powered by Razorpay. 100% secure.</p>
            </div>
          </div>
        </div>
      </div>
    </ShopLayout>
  );
}
