import Link from 'next/link';
import { Trash2, ShoppingBag } from 'lucide-react';
import ShopLayout from '@/components/ShopLayout';
import { useCart } from '@/lib/cart';

export default function CartPage() {
  const { items, totalPaise, removeItem, updateQty } = useCart();

  if (items.length === 0) {
    return (
      <ShopLayout title="Cart">
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <ShoppingBag className="h-14 w-14 text-gray-300 mb-4" />
          <p className="text-gray-600 text-lg font-semibold mb-2">Your cart is empty</p>
          <p className="text-gray-400 text-sm mb-6">Add some Mailair goodies to get started.</p>
          <Link href="/shop" className="bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl px-6 py-3 transition-colors text-sm">
            Browse Shop
          </Link>
        </div>
      </ShopLayout>
    );
  }

  const total = totalPaise / 100;

  return (
    <ShopLayout title="Cart">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-extrabold text-gray-900">Your Cart</h1>

        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={i} className="flex flex-col sm:flex-row gap-4 bg-white border border-gray-200 rounded-2xl p-4">
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                {item.image ? (
                  <img src={item.image} alt={item.product_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ShoppingBag className="h-6 w-6 text-gray-400" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{item.product_name}</p>
                {item.variant && <p className="text-xs text-gray-500">{item.variant}</p>}
                {item.customization && <p className="text-xs text-olive-600">Custom: {item.customization}</p>}
                <p className="text-sm font-bold text-primary-600 mt-1">₹{(item.unit_price / 100).toLocaleString('en-IN')}</p>
              </div>
              <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2">
                <button onClick={() => removeItem(item.product_id, item.variant)} className="text-gray-400 hover:text-urgent transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-2 py-1">
                  <button onClick={() => updateQty(item.product_id, item.variant, item.quantity - 1)} className="text-gray-500 hover:text-gray-900 w-5 h-5 flex items-center justify-center text-sm">−</button>
                  <span className="text-gray-900 text-sm font-semibold w-5 text-center">{item.quantity}</span>
                  <button onClick={() => updateQty(item.product_id, item.variant, item.quantity + 1)} className="text-gray-500 hover:text-gray-900 w-5 h-5 flex items-center justify-center text-sm">+</button>
                </div>
                <p className="text-xs text-gray-500">₹{(item.unit_price * item.quantity / 100).toLocaleString('en-IN')}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
          <div className="flex justify-between text-sm text-gray-500">
            <span>Subtotal ({items.reduce((s, i) => s + i.quantity, 0)} items)</span>
            <span className="text-gray-900 font-semibold">₹{total.toLocaleString('en-IN')}</span>
          </div>
          {total < 999 && (
            <div className="text-xs text-warning bg-warning/10 rounded-lg px-3 py-2">
              Add ₹{(999 - total).toFixed(0)} more for free shipping!
            </div>
          )}
          <div className="border-t border-gray-200 pt-3 flex justify-between">
            <span className="font-semibold text-gray-900">Total</span>
            <span className="text-xl font-bold text-primary-600">₹{total.toLocaleString('en-IN')}</span>
          </div>
          <Link href="/shop/checkout"
            className="block w-full text-center bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl py-3 transition-colors mt-2">
            Proceed to Checkout
          </Link>
          <Link href="/shop" className="block w-full text-center text-sm text-gray-500 hover:text-gray-900 transition-colors py-1">
            Continue Shopping
          </Link>
        </div>
      </div>
    </ShopLayout>
  );
}
