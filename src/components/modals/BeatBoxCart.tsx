import { useMemo, useState } from 'react';
import { CreditCard, Lock, Mail, ShoppingBag, Trash2, Wallet, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import type { Beat } from '../../types';
import { canBuyBeat, getBeatPriceLabel, getBeatPriceValue } from '../../utils/beatAccess';

type CheckoutStep = 'cart' | 'checkout' | 'confirm';
type PaymentMethod = 'stripe' | 'cashapp' | 'paypal';

interface CheckoutForm {
  name: string;
  email: string;
  method: PaymentMethod;
}

const CASH_APP_HANDLE = '$RoyceRipken';
const PAYPAL_EMAIL = 'daddygangthreads@gmail.com';

const paymentCopy: Record<PaymentMethod, { label: string; destination: string; helper: string }> = {
  stripe: {
    label: 'Stripe Checkout',
    destination: 'Secure checkout',
    helper: 'Pay by card through a secure Stripe checkout page.',
  },
  cashapp: {
    label: 'Cash App',
    destination: CASH_APP_HANDLE,
    helper: 'Open Cash App to pay.',
  },
  paypal: {
    label: 'PayPal',
    destination: PAYPAL_EMAIL,
    helper: 'Submit the request after sending PayPal payment.',
  },
};

const money = (value: number) => `$${Number.isFinite(value) ? value.toFixed(2) : '0.00'}`;

const getBeatPrice = (beat: Beat) => getBeatPriceValue(beat);

const buildOrderPayload = (beat: Beat, form: CheckoutForm) => ({
  beat_id: beat.id,
  beat_name: beat.title,
  beat_thumbnail: beat.cover_art_url || null,
  buyer_name: form.name.trim(),
  buyer_email: form.email.trim().toLowerCase(),
  payment_method: form.method,
  payment_destination: paymentCopy[form.method].destination,
  amount: getBeatPrice(beat),
  status: 'Pending Verification',
  release_download: false,
  sold: false,
  admin_approved: false,
  payment_received: false,
  admin_notes: null,
});

export function BeatBoxCart() {
  const { cart, removeFromCart, clearCart, setCartOpen, addToast } = useApp();
  const [step, setStep] = useState<CheckoutStep>('cart');
  const [form, setForm] = useState<CheckoutForm>({ name: '', email: '', method: 'stripe' });
  const [loading, setLoading] = useState(false);
  const [orderCount, setOrderCount] = useState(0);

  const total = useMemo(() => cart.reduce((sum, beat) => sum + getBeatPrice(beat), 0), [cart]);
  const selectedPayment = paymentCopy[form.method];
  const hasCartItems = cart.length > 0;

  const updateForm = <Key extends keyof CheckoutForm>(key: Key, value: CheckoutForm[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const validateCheckout = () => {
    if (!hasCartItems) {
      addToast('Your Beat Box is empty.', 'error');
      return false;
    }

    if (cart.some((beat) => !canBuyBeat(beat))) {
      addToast('Beat Box contains a free, sold, or invalid beat. Remove it before checkout.', 'error');
      return false;
    }

    if (total <= 0) {
      addToast('Beat Box total must be above $0 for checkout.', 'error');
      return false;
    }

    if (!form.name.trim()) {
      addToast('Enter your name before checkout.', 'error');
      return false;
    }

    if (!form.email.trim() || !form.email.includes('@')) {
      addToast('Enter a valid email before checkout.', 'error');
      return false;
    }

    return true;
  };

  const insertOrders = async (notify: boolean) => {
    const orderPayloads = cart.map((beat) => buildOrderPayload(beat, form));
    const { data, error } = await supabase.from('orders').insert(orderPayloads).select('id, beat_id');

    if (error || !data || data.length !== orderPayloads.length) {
      throw new Error(error?.message || 'Order creation failed.');
    }

    if (notify) {
      await supabase.from('notifications').insert({
        type: 'sale',
        title: `New Beat Box Order: ${cart.length} beat${cart.length === 1 ? '' : 's'}`,
        body: `${form.name.trim()} submitted a ${selectedPayment.label} order for ${money(total)}. Once payment is processed, your download will be available.`,
        data: {
          order_ids: data.map((order) => order.id),
          buyer_email: form.email.trim().toLowerCase(),
          payment_method: form.method,
          total,
        },
      });
    }

    return data;
  };

  const startStripeCheckout = async () => {
    const orders = await insertOrders(false);
    const checkoutItems = cart.map((beat) => ({
      order_id: orders.find((order) => order.beat_id === beat.id)?.id,
      beat_id: beat.id,
      beat_name: beat.title,
      beat_thumbnail: beat.cover_art_url || null,
      amount: getBeatPrice(beat),
    }));

    const { data, error } = await supabase.functions.invoke('stripe-checkout', {
      body: {
        buyer_name: form.name.trim(),
        buyer_email: form.email.trim().toLowerCase(),
        items: checkoutItems,
        source: 'beat_box_cart',
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    const checkoutUrl = typeof data?.url === 'string' ? data.url : '';

    if (!checkoutUrl) {
      throw new Error('Stripe checkout URL was not returned.');
    }

    clearCart();
    window.location.assign(checkoutUrl);
  };

  const handleCheckout = async () => {
    if (!validateCheckout()) return;

    setLoading(true);

    try {
      if (form.method === 'stripe') {
        await startStripeCheckout();
        return;
      }

      const placedOrders = await insertOrders(true);
      setOrderCount(placedOrders.length);
      clearCart();
      setStep('confirm');
      addToast('Order request submitted. Downloads stay locked until release.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Something went wrong. Your order was not placed.';
      addToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const closeCart = () => {
    setCartOpen(false);
  };

  return (
    <div
      className="modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) closeCart();
      }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="modal-box max-w-md w-full" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <ShoppingBag size={18} className="text-[#f5c518]" />
            <h2 className="font-display font-800 text-lg uppercase tracking-wider text-white">Beat Box</h2>
            {hasCartItems && step === 'cart' && (
              <span className="text-xs bg-[#f5c518] text-black rounded-full px-2 py-0.5 font-bold">
                {cart.length}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={closeCart}
            className="w-9 h-9 rounded-full hover:bg-white/5 bg-white/[0.03] text-[#666] hover:text-white transition-colors flex items-center justify-center"
            aria-label="Close cart"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          {step === 'cart' && (
            <>
              {!hasCartItems ? (
                <div className="text-center py-10 text-[#444]">
                  <ShoppingBag size={40} className="mx-auto mb-3 opacity-30" />
                  <div className="font-display text-lg">Beat Box is empty</div>
                  <p className="text-xs text-[#666] mt-2">Add beats from the lab to request a package.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="max-h-[42vh] overflow-y-auto pr-1 space-y-3">
                    {cart.map((beat) => (
                      <div key={beat.id} className="flex items-center gap-3 p-3.5 bg-[#111] rounded-2xl border border-white/5 shadow-[0_14px_28px_rgba(0,0,0,0.2)]">
                        {beat.cover_art_url ? (
                          <img src={beat.cover_art_url} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-[#1a1a1a] flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-display font-700 text-sm text-white truncate">{beat.title}</div>
                          <div className="text-[#f5c518] text-sm font-bold">
                            {getBeatPriceLabel(beat)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFromCart(beat.id)}
                          className="text-[#555] hover:text-red-400 transition-colors p-1"
                          aria-label={`Remove ${beat.title}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-[#1e1e1e] pt-3 flex items-center justify-between">
                    <span className="text-[#888] text-sm">Total</span>
                    <span className="font-display font-800 text-xl text-[#f5c518]">{money(total)}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setStep('checkout')}
                    className="btn-gold w-full py-3.5 rounded-2xl text-sm mt-2 flex items-center justify-center gap-2"
                  >
                    <CreditCard size={16} />
                    Checkout
                  </button>
                </div>
              )}
            </>
          )}

          {step === 'checkout' && (
            <div className="space-y-4">
              <div className="grid gap-3">
                <label className="block">
                  <span className="sr-only">Your name</span>
                  <input
                    className="input-dark w-full px-4 py-3.5 text-sm"
                    placeholder="Your name"
                    value={form.name}
                    onChange={(event) => updateForm('name', event.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="sr-only">Your email</span>
                  <input
                    className="input-dark w-full px-4 py-3.5 text-sm"
                    placeholder="Your email"
                    type="email"
                    value={form.email}
                    onChange={(event) => updateForm('email', event.target.value)}
                  />
                </label>
              </div>

              <div className="space-y-2">
                <div className="text-xs text-[#666] uppercase tracking-wider">Payment Method</div>
                {(Object.keys(paymentCopy) as PaymentMethod[]).map((method) => {
                  const option = paymentCopy[method];
                  const selected = form.method === method;

                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() => updateForm('method', method)}
                      className={`w-full p-3.5 rounded-2xl border text-left transition-all ${
                        selected
                          ? 'border-[#f5c518] bg-[#f5c518]/5 text-white'
                          : 'border-[#1e1e1e] bg-[#0f0f0f] text-[#888] hover:border-[#333]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium text-sm">{option.label}</div>
                          <div className="text-xs text-[#666] mt-0.5">{option.destination}</div>
                        </div>
                        {method === 'stripe' ? <CreditCard size={17} /> : <Wallet size={17} />}
                      </div>
                      <div className="text-xs text-[#777] mt-2 leading-relaxed">{option.helper}</div>
                    </button>
                  );
                })}
              </div>

              <div className="p-3.5 bg-[#0d0d0d] rounded-2xl border border-[#1e1e1e] text-xs text-[#888] leading-relaxed flex gap-2">
                <Lock size={15} className="text-[#f5c518] flex-shrink-0 mt-0.5" />
                <span>
                  Once payment is processed, your download will be available.
                </span>
              </div>

              {form.method !== 'stripe' && (
                <div className="text-center text-sm text-[#888] leading-relaxed">
                  Send <span className="text-[#f5c518] font-bold">{money(total)}</span> to{' '}
                  <span className="text-white font-bold">{selectedPayment.destination}</span>, then Pay using the selected method.
                </div>
              )}

              <button
                type="button"
                onClick={handleCheckout}
                disabled={loading}
                className="btn-gold w-full py-3 rounded-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {form.method === 'stripe' ? <CreditCard size={16} /> : <Mail size={16} />}
                {loading ? 'Processing...' : form.method === 'stripe' ? 'Continue to Stripe' : 'Continue to Payment'}
              </button>

              <button
                type="button"
                onClick={() => setStep('cart')}
                className="w-full py-2 text-xs text-[#555] hover:text-[#888] transition-colors"
              >
                Back to cart
              </button>
            </div>
          )}

          {step === 'confirm' && (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-[#f5c518]/10 border border-[#f5c518]/30 flex items-center justify-center mx-auto">
                <Lock size={28} className="text-[#f5c518]" />
              </div>
              <div className="font-display text-2xl font-900 text-[#f5c518] uppercase tracking-wide">Order Submitted</div>
              <p className="text-[#888] text-sm leading-relaxed max-w-xs mx-auto">
                {orderCount} beat request{orderCount === 1 ? '' : 's'} logged. Once payment is processed, your download will be available.
              </p>
              <button type="button" onClick={closeCart} className="btn-gold px-8 py-3 rounded-xl text-sm">
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

