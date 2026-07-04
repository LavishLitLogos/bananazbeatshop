import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, CreditCard, Lock, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../context/AppContext';
import type { Beat } from '../../types';
import { canBuyBeat, getBeatPriceLabel, getBeatPriceValue, isBeatFree } from '../../utils/beatAccess';

interface BuyModalProps {
  beat: Beat;
  onClose: () => void;
}

type PaymentMethod = 'stripe' | 'cashapp' | 'paypal';
type ModalStep = 'form' | 'manual-confirmed';

interface BuyerForm {
  name: string;
  email: string;
  paymentMethod: PaymentMethod;
}

interface PaymentOption {
  id: PaymentMethod;
  label: string;
  helper: string;
  destination?: string;
}

const DEFAULT_PAYPAL_DESTINATION = 'daddygangthreads@gmail.com';
const DEFAULT_CASHAPP_DESTINATION = '$RoyceRipken';

function formatMoney(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number.isFinite(amount) ? amount : 0);
}

function getPaymentDestination(method: PaymentMethod) {
  if (method === 'paypal') return DEFAULT_PAYPAL_DESTINATION;
  if (method === 'cashapp') return DEFAULT_CASHAPP_DESTINATION;
  return undefined;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function BuyModal({ beat, onClose }: BuyModalProps) {
  const { addToast } = useApp();
  const [step, setStep] = useState<ModalStep>('form');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<BuyerForm>({
    name: '',
    email: '',
    paymentMethod: 'stripe',
  });

  const price = getBeatPriceValue(beat);
  const destination = getPaymentDestination(form.paymentMethod);

  const paymentOptions = useMemo<PaymentOption[]>(
    () => [
      {
        id: 'stripe',
        label: 'Card / Stripe Checkout',
        helper: 'Secure checkout opens next. Once payment is processed, your download will be available.',
      },
      {
        id: 'cashapp',
        label: 'Cash App',
        helper: 'Open Cash App to pay.',
        destination: DEFAULT_CASHAPP_DESTINATION,
      },
      {
        id: 'paypal',
        label: 'PayPal',
        helper: 'Submit the request here, then send payment in PayPal.',
        destination: DEFAULT_PAYPAL_DESTINATION,
      },
    ],
    []
  );

  const updateForm = (field: keyof BuyerForm, value: string) => {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  };

  const validateForm = () => {
    if (!form.name.trim()) {
      addToast('Name is required.', 'error');
      return false;
    }
    if (!isValidEmail(form.email)) {
      addToast('A valid email is required.', 'error');
      return false;
    }
    if (isBeatFree(beat) || beat.sold) {
      addToast(beat.sold ? 'This beat is sold.' : 'Free beats do not need purchase.', 'info');
      return false;
    }
    if (!canBuyBeat(beat)) {
      addToast('This beat does not have a valid checkout price.', 'error');
      return false;
    }
    return true;
  };

  const createManualOrder = async () => {
    const methodLabel = form.paymentMethod === 'cashapp' ? 'Cash App' : 'PayPal';
    const { error } = await supabase.from('orders').insert({
      beat_id: beat.id,
      beat_name: beat.title,
      beat_thumbnail: beat.cover_art_url || null,
      buyer_name: form.name.trim(),
      buyer_email: form.email.trim().toLowerCase(),
      payment_method: methodLabel,
      payment_destination: destination || null,
      amount: price,
      status: 'Pending Verification',
      release_download: false,
      sold: false,
      admin_approved: false,
      payment_received: false,
    });
    if (error) throw error;
    const { error: notificationError } = await supabase.from('notifications').insert({
      type: 'sale',
      title: `New ${methodLabel} Request: ${beat.title}`,
      body: `${form.name.trim()} requested ${beat.title} for ${formatMoney(price)}.`,
      data: {
        beat_id: beat.id,
        beat_title: beat.title,
        buyer_email: form.email.trim().toLowerCase(),
        payment_method: methodLabel,
        amount: price,
      },
    });
    if (notificationError) {
      console.warn('Order was saved, but the notification was not created.', notificationError);
    }
  };

  const startStripeCheckout = async () => {
    const origin = window.location.origin;
    const { data: orders, error: orderError } = await supabase.from('orders').insert({
      beat_id: beat.id,
      beat_name: beat.title,
      beat_thumbnail: beat.cover_art_url || null,
      buyer_name: form.name.trim(),
      buyer_email: form.email.trim().toLowerCase(),
      payment_method: 'stripe',
      payment_destination: 'Secure checkout',
      amount: price,
      status: 'Pending Verification',
      release_download: false,
      sold: false,
      admin_approved: false,
      payment_received: false,
    }).select('id').single();

    if (orderError || !orders?.id) {
      throw new Error(orderError?.message || 'Order creation failed.');
    }

    const { data, error } = await supabase.functions.invoke('stripe-checkout', {
      body: {
        orderId: orders.id,
        beatId: beat.id,
        beatTitle: beat.title,
        beatThumbnail: beat.cover_art_url || null,
        buyerName: form.name.trim(),
        buyerEmail: form.email.trim().toLowerCase(),
        amount: price,
        successUrl: `${origin}/?checkout=success`,
        cancelUrl: `${origin}/?checkout=cancelled`,
      },
    });
    if (error) throw error;
    const checkoutUrl = typeof data?.url === 'string' ? data.url : '';
    if (!checkoutUrl) {
      throw new Error('Stripe checkout did not return a redirect URL.');
    }
    window.location.assign(checkoutUrl);
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setLoading(true);
    try {
      if (form.paymentMethod === 'stripe') {
        await startStripeCheckout();
        return;
      }
      await createManualOrder();
      setStep('manual-confirmed');
    } catch (error) {
      console.error('Purchase request failed:', error);
      addToast('Purchase request failed. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const selectedMethodLabel =
    paymentOptions.find((option) => option.id === form.paymentMethod)?.label || 'Selected Payment';

  return (
    <div
      className="modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="modal-box cracked-shell-panel console-panel neon-frame glow-yellow cut-corner-card max-w-md w-full" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div>
            <h2 className="font-display font-800 text-lg uppercase tracking-wider text-white">
              Purchase Beat
            </h2>
            <p className="text-xs text-[#777] mt-0.5">Locked download. Admin release required.</p>
          </div>
          {/* X CLOSE — always visible */}
          <button
            type="button"
            onClick={onClose}
            className="hardware-button w-9 h-9 rounded-full hover:bg-white/5 bg-white/[0.03] text-[#666] hover:text-white transition-colors flex items-center justify-center"
            aria-label="Close purchase modal"
          >
            <X size={18} />
          </button>
        </div>

        {step === 'form' && (
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3 p-3.5 bg-[#101010] rounded-2xl border border-white/5 shadow-[0_16px_34px_rgba(0,0,0,0.24)]">
              {beat.cover_art_url ? (
                <img src={beat.cover_art_url} alt={beat.title} className="w-14 h-14 rounded-lg object-cover" />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-[#1a1a1a]" />
              )}
              <div className="min-w-0 flex-1">
                <div className="font-display font-800 text-white truncate">{beat.title}</div>
                <div className={`font-black ${isBeatFree(beat) ? 'text-green-400' : 'text-[#f5c518]'}`}>
                  {getBeatPriceLabel(beat)}
                </div>
              </div>
              <Lock size={18} className="text-[#f5c518] flex-shrink-0" />
            </div>

            <div className="grid gap-3">
              <input
                className="input-dark w-full px-4 py-3.5 text-sm"
                placeholder="Your name"
                value={form.name}
                autoComplete="name"
                onChange={(event) => updateForm('name', event.target.value)}
              />
              <input
                className="input-dark w-full px-4 py-3.5 text-sm"
                placeholder="Your email"
                type="email"
                value={form.email}
                autoComplete="email"
                onChange={(event) => updateForm('email', event.target.value)}
              />
            </div>

            <div className="space-y-2">
              {paymentOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => updateForm('paymentMethod', option.id)}
                  className={`w-full p-3.5 rounded-2xl border text-left transition-all ${
                    form.paymentMethod === option.id
                      ? 'border-[#f5c518] bg-[#f5c518]/10 text-white'
                      : 'border-[#1e1e1e] bg-[#0f0f0f] text-[#888] hover:border-[#2a2a2a]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-bold">{option.label}</div>
                    {option.id === 'stripe' && <CreditCard size={16} className="text-[#f5c518]" />}
                  </div>
                  <div className="text-xs text-[#777] mt-1 leading-relaxed">{option.helper}</div>
                  {option.destination && (
                    <div className="text-xs text-[#f5c518] font-bold mt-1">{option.destination}</div>
                  )}
                </button>
              ))}
            </div>

            <div className="p-3.5 bg-[#0a0a0a] rounded-2xl border border-[#f5c518]/20 text-xs text-[#777] leading-relaxed">
              <div className="flex items-start gap-2">
                <AlertTriangle size={14} className="text-[#f5c518] flex-shrink-0 mt-0.5" />
                <div>Once payment is processed, your download will be available.</div>
              </div>
            </div>

            {destination && (
              <div className="text-center text-sm text-[#999]">
                Send{' '}
                <span className={`font-black ${isBeatFree(beat) ? 'text-green-400' : 'text-[#f5c518]'}`}>
                  {getBeatPriceLabel(beat)}
                </span>{' '}
                to <span className="text-white font-black">{destination}</span> after submitting this request.
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              data-fx="lightning"
              className="btn-gold w-full py-3 rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <CreditCard size={16} />
              {loading
                ? 'Processing...'
                : form.paymentMethod === 'stripe'
                  ? 'Continue to Secure Checkout'
                  : `Submit ${selectedMethodLabel} Request`}
            </button>
          </div>
        )}

        {step === 'manual-confirmed' && (
          <div className="p-5 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-[#f5c518]/10 border border-[#f5c518]/30 flex items-center justify-center mx-auto">
              <CheckCircle2 size={26} className="text-[#f5c518]" />
            </div>
            <div className="font-display text-2xl font-900 text-[#f5c518] uppercase tracking-wide">
              Request Received
            </div>
            <div className="p-3 bg-[#0a0a0a] rounded-xl border border-[#f5c518]/20 text-xs text-[#777] leading-relaxed">
              <div className="flex items-start gap-2 text-left">
                <Clock size={14} className="text-[#f5c518] flex-shrink-0 mt-0.5" />
                <div>
                  Your order is pending verification. Once payment is confirmed, admin can release the download. Until
                  then, the beat remains locked.
                </div>
              </div>
            </div>
            {destination && (
              <div className="text-sm text-[#999]">
                Payment destination:{' '}
                <span className="text-white font-black">{destination}</span>
              </div>
            )}
            <button type="button" onClick={onClose} data-fx="lightning" className="btn-gold px-8 py-3 rounded-xl text-sm">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
