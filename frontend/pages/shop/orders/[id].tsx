import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { CheckCircle, Loader2, Package } from 'lucide-react';
import Link from 'next/link';
import ShopLayout from '@/components/ShopLayout';
import { shopApi } from '@/lib/api';
import type { ShopOrder } from '@/lib/types';

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending: { label: 'Payment Pending', color: 'text-warning' },
  paid: { label: 'Paid — Processing', color: 'text-success' },
  shipped: { label: 'Shipped', color: 'text-primary-700' },
  delivered: { label: 'Delivered', color: 'text-success' },
  cancelled: { label: 'Cancelled', color: 'text-urgent' },
};

export default function OrderConfirmationPage() {
  const router = useRouter();
  const { id, email } = router.query;
  const [order, setOrder] = useState<ShopOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id || !email) return;
    shopApi.getOrder(id as string, email as string)
      .then(setOrder)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id, email]);

  if (loading) return (
    <ShopLayout title="Order Confirmation">
      <div className="flex items-center justify-center py-32"><Loader2 className="h-6 w-6 text-gray-500 animate-spin" /></div>
    </ShopLayout>
  );

  if (error || !order) return (
    <ShopLayout title="Order Not Found">
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 border border-gray-200 mb-4">
          <Package className="h-7 w-7 text-gray-500" />
        </div>
        <p className="text-gray-900 font-semibold text-lg mb-1">Order not found</p>
        <p className="text-gray-500 text-sm mb-2">We couldn't find this order. A confirmation email was sent — check your inbox.</p>
        <p className="text-gray-400 text-xs mb-6">If you just paid, it may take a few seconds. Try refreshing.</p>
        <div className="flex gap-3">
          <button onClick={() => router.reload()} className="bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition-colors">
            Refresh
          </button>
          <Link href="/shop" className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-medium rounded-xl px-5 py-2.5 text-sm transition-colors">
            Back to Shop
          </Link>
        </div>
      </div>
    </ShopLayout>
  );

  const status = STATUS_LABEL[order.status] || { label: order.status, color: 'text-gray-500' };

  return (
    <ShopLayout title="Order Confirmed">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success/10 border border-success/20 mb-4">
            <CheckCircle className="h-8 w-8 text-success" />
          </div>
          <h1 className="font-serif text-2xl text-gray-900 mb-1">Order Confirmed!</h1>
          <p className="text-gray-500 text-sm">Thanks {order.customer_name}! A confirmation email is on its way.</p>
        </div>

        {/* Order details */}
        <div className="bg-white border border-gray-200 shadow-warm rounded-2xl p-5 space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Order ID</p>
              <p className="text-sm font-mono text-gray-900 mt-0.5">{order.id.slice(0, 8).toUpperCase()}</p>
            </div>
            <span className={`text-sm font-semibold ${status.color}`}>{status.label}</span>
          </div>

          <div className="border-t border-gray-200 pt-4 space-y-2">
            {order.items.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-gray-700">
                  {item.product_name}
                  {item.variant ? <span className="text-gray-500"> — {item.variant}</span> : null}
                  {item.customization ? <span className="text-olive-600"> — {item.customization}</span> : null}
                  <span className="text-gray-500"> ×{item.quantity}</span>
                </span>
                <span className="text-gray-900 font-medium">₹{(item.unit_price * item.quantity / 100).toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-200 pt-3 flex justify-between">
            <span className="font-semibold text-gray-900">Total Paid</span>
            <span className="text-xl font-bold text-primary-700">₹{(order.total_paise / 100).toLocaleString('en-IN')}</span>
          </div>
        </div>

        {/* Shipping address */}
        <div className="bg-white border border-gray-200 shadow-warm rounded-2xl p-5 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Shipping To</p>
          <div className="text-sm text-gray-700 space-y-0.5">
            <p className="font-semibold text-gray-900">{order.shipping_address.name}</p>
            <p>{order.shipping_address.line1}</p>
            {order.shipping_address.line2 && <p>{order.shipping_address.line2}</p>}
            <p>{order.shipping_address.city}, {order.shipping_address.state} — {order.shipping_address.pincode}</p>
            <p className="text-gray-500">{order.shipping_address.phone}</p>
          </div>
        </div>

        <div className="text-center space-y-3 pb-8">
          <p className="text-xs text-gray-500">Ships within 3-5 business days. Questions? Reply to your confirmation email.</p>
          <Link href="/shop" className="inline-block bg-white hover:bg-gray-50 border border-gray-200 text-sm text-gray-700 font-medium rounded-xl px-6 py-2.5 transition-colors">
            Back to Shop
          </Link>
        </div>
      </div>
    </ShopLayout>
  );
}
