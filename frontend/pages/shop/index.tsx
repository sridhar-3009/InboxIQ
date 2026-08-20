import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ShoppingBag, Loader2, WifiOff, RefreshCw } from 'lucide-react';
import ShopLayout from '@/components/ShopLayout';
import { shopApi } from '@/lib/api';
import type { ShopProduct } from '@/lib/types';

const CATEGORIES = ['all', 'apparel', 'accessories', 'stationery', 'digital'];

function ProductCard({ product }: { product: ShopProduct }) {
  return (
    <Link href={`/shop/${product.id}`} className="group block">
      <div className="aspect-square rounded-2xl overflow-hidden bg-gray-100 border border-gray-200 mb-3">
        {product.images[0] ? (
          <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingBag className="h-12 w-12 text-gray-400" />
          </div>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-gray-900 group-hover:text-primary-600 transition-colors line-clamp-1">{product.name}</p>
        <p className="text-xs text-gray-500 line-clamp-2">{product.description}</p>
        <div className="flex items-center justify-between pt-1">
          <p className="text-sm font-bold text-primary-600">₹{product.price.toLocaleString('en-IN')}</p>
          {product.allows_custom && (
            <span className="text-xs text-olive-600 border border-olive-400/40 rounded-full px-2 py-0.5">Customizable</span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function ShopPage() {
  const router = useRouter();
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const category = (router.query.category as string) || 'all';

  const load = () => {
    setLoading(true);
    setFetchError(false);
    shopApi.listProducts(category === 'all' ? undefined : category)
      .then(d => setProducts(d.products || []))
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  };

  useEffect(load, [category]);

  return (
    <ShopLayout title="Shop">
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Mailair Merch</h1>
          <p className="text-gray-500 text-sm">Original designs. Made with love.</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => router.push(cat === 'all' ? '/shop' : `/shop?category=${cat}`, undefined, { shallow: true })}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all capitalize ${
                category === cat
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 text-gray-400 animate-spin" />
          </div>
        ) : fetchError ? (
          <div className="text-center py-24 space-y-4">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-urgent/10 border border-urgent/20">
              <WifiOff className="h-6 w-6 text-urgent" />
            </div>
            <div>
              <p className="text-gray-900 font-semibold mb-1">Couldn't load products</p>
              <p className="text-gray-500 text-sm">Check your connection and try again.</p>
            </div>
            <button onClick={load} className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-sm text-gray-900 font-medium rounded-xl px-5 py-2.5 transition-colors">
              <RefreshCw className="h-4 w-4" /> Retry
            </button>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-24">
            <ShoppingBag className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No products here yet. Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </div>
    </ShopLayout>
  );
}
