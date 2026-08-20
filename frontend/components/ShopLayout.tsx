import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ShoppingCart, Menu, X, ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { useCart } from '@/lib/cart';

interface ShopLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export default function ShopLayout({ children, title }: ShopLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { totalItems } = useCart();
  const router = useRouter();

  return (
    <>
      <Head>
        <title>{title ? `${title} — Mailair Shop` : 'Mailair Shop'}</title>
      </Head>
      <div className="min-h-screen bg-gray-50">
        {/* Nav */}
        <nav className="sticky top-0 z-50 bg-gray-50/90 backdrop-blur-md border-b border-gray-200">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/" className="text-gray-400 hover:text-gray-900 transition-colors">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
                <Link href="/shop" className="flex items-center gap-2">
                  <span className="font-serif text-lg text-gray-900">Mail<span className="text-primary-600">air</span></span>
                  <span className="text-xs font-semibold text-gray-500 border border-gray-300 rounded-full px-2 py-0.5">Shop</span>
                </Link>
              </div>
              <div className="flex items-center gap-6">
                <div className="hidden md:flex items-center gap-6">
                  <Link href="/shop" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">All</Link>
                  <Link href="/shop?category=apparel" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Apparel</Link>
                  <Link href="/shop?category=accessories" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Accessories</Link>
                  <Link href="/shop?category=stationery" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Stationery</Link>
                </div>
                <Link href="/shop/cart" className="relative flex items-center gap-1.5 rounded-md border border-gray-200 bg-white hover:bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 transition-all">
                  <ShoppingCart className="h-4 w-4" />
                  <span className="hidden sm:inline">Cart</span>
                  {totalItems > 0 && (
                    <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">
                      {totalItems}
                    </span>
                  )}
                </Link>
                <button className="md:hidden text-gray-500" onClick={() => setMobileOpen(!mobileOpen)}>
                  {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>
          {mobileOpen && (
            <div className="md:hidden border-t border-gray-200 bg-gray-50 px-4 py-3 space-y-2">
              {['all', 'apparel', 'accessories', 'stationery'].map(cat => (
                <Link key={cat} href={cat === 'all' ? '/shop' : `/shop?category=${cat}`} onClick={() => setMobileOpen(false)}
                  className="block text-sm text-gray-600 py-1 capitalize">{cat}</Link>
              ))}
            </div>
          )}
        </nav>

        {/* Content */}
        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-gray-200 py-8 mt-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-500">© {new Date().getFullYear()} Mailair. All designs original.</p>
            <div className="flex gap-6">
              <Link href="/shop" className="text-sm text-gray-500 hover:text-gray-800">Shop</Link>
              <Link href="/" className="text-sm text-gray-500 hover:text-gray-800">Back to App</Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
