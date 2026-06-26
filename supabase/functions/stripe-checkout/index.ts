import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

type StripeOrderUpdate = {
  status: string;
  payment_received: boolean;
  payment_status: string;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_customer_email: string | null;
  paid_at: string | null;
  release_download: false;
};

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') || '';
const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-12-18.acacia',
  appInfo: {
    name: 'ThisBeatIzBananaz Beat Shop',
    version: '1.0.0',
  },
});

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function getRequiredEnv(value: string, label: string): string {
  if (!value) {
    throw new Error(`${label} is not configured.`);
  }

  return value;
}

function parseOrderIds(value: unknown): string[] {
  if (typeof value !== 'string') {
    return [];
  }

  return value
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

function getSessionOrderIds(session: Stripe.Checkout.Session): string[] {
  const metadataOrderIds = parseOrderIds(session.metadata?.order_ids);

  if (metadataOrderIds.length > 0) {
    return metadataOrderIds;
  }

  return parseOrderIds(session.payment_intent && typeof session.payment_intent !== 'string'
    ? session.payment_intent.metadata?.order_ids
    : undefined);
}

function paymentIntentIdFromSession(session: Stripe.Checkout.Session): string | null {
  if (!session.payment_intent) {
    return null;
  }

  if (typeof session.payment_intent === 'string') {
    return session.payment_intent;
  }

  return session.payment_intent.id;
}

async function updateOrdersFromPaidSession(session: Stripe.Checkout.Session): Promise<void> {
  const orderIds = getSessionOrderIds(session);

  if (orderIds.length === 0) {
    console.warn('Stripe webhook received paid checkout session with no order_ids metadata.');
    return;
  }

  const update: StripeOrderUpdate = {
    status: 'Paid - Awaiting Admin Release',
    payment_received: true,
    payment_status: session.payment_status || 'paid',
    stripe_session_id: session.id,
    stripe_payment_intent_id: paymentIntentIdFromSession(session),
    stripe_customer_email: session.customer_email || session.customer_details?.email || null,
    paid_at: new Date().toISOString(),
    release_download: false,
  };

  const { error } = await supabase
    .from('orders')
    .update(update)
    .in('id', orderIds);

  if (error) {
    throw new Error(`Unable to update Stripe order payment status: ${error.message}`);
  }

  await createAdminNotification({
    orderIds,
    session,
  });
}

async function updateOrdersFromExpiredSession(session: Stripe.Checkout.Session): Promise<void> {
  const orderIds = getSessionOrderIds(session);

  if (orderIds.length === 0) {
    return;
  }

  const { error } = await supabase
    .from('orders')
    .update({
      status: 'Stripe Checkout Expired',
      payment_received: false,
      payment_status: 'expired',
      stripe_session_id: session.id,
      stripe_payment_intent_id: paymentIntentIdFromSession(session),
      release_download: false,
    })
    .in('id', orderIds);

  if (error) {
    throw new Error(`Unable to mark Stripe checkout expired: ${error.message}`);
  }
}

async function createAdminNotification(params: {
  orderIds: string[];
  session: Stripe.Checkout.Session;
}): Promise<void> {
  const amountTotal = typeof params.session.amount_total === 'number'
    ? params.session.amount_total / 100
    : 0;
  const buyerEmail = params.session.customer_email || params.session.customer_details?.email || 'unknown buyer';

  const { error } = await supabase.from('notifications').insert({
    type: 'sale',
    title: 'Stripe payment received',
    body: `Stripe payment received from ${buyerEmail} for $${amountTotal.toFixed(2)}. Download is still locked until admin release.`,
    data: {
      order_ids: params.orderIds,
      stripe_session_id: params.session.id,
      stripe_payment_intent_id: paymentIntentIdFromSession(params.session),
      buyer_email: buyerEmail,
      amount_total: amountTotal,
      download_release: 'admin_only',
    },
  });

  if (error) {
    console.warn('Stripe webhook updated orders, but notification failed:', error.message);
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  if (session.payment_status === 'paid') {
    await updateOrdersFromPaidSession(session);
    return;
  }

  const orderIds = getSessionOrderIds(session);

  if (orderIds.length === 0) {
    return;
  }

  const { error } = await supabase
    .from('orders')
    .update({
      status: 'Stripe Checkout Complete - Payment Pending',
      payment_received: false,
      payment_status: session.payment_status || 'unpaid',
      stripe_session_id: session.id,
      stripe_payment_intent_id: paymentIntentIdFromSession(session),
      release_download: false,
    })
    .in('id', orderIds);

  if (error) {
    throw new Error(`Unable to update pending Stripe checkout: ${error.message}`);
  }
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  const orderIds = parseOrderIds(paymentIntent.metadata?.order_ids);

  if (orderIds.length === 0) {
    return;
  }

  const { error } = await supabase
    .from('orders')
    .update({
      status: 'Paid - Awaiting Admin Release',
      payment_received: true,
      payment_status: 'paid',
      stripe_payment_intent_id: paymentIntent.id,
      paid_at: new Date().toISOString(),
      release_download: false,
    })
    .in('id', orderIds);

  if (error) {
    throw new Error(`Unable to update Stripe payment intent status: ${error.message}`);
  }
}

async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
      break;

    case 'checkout.session.expired':
      await updateOrdersFromExpiredSession(event.data.object as Stripe.Checkout.Session);
      break;

    case 'payment_intent.succeeded':
      await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
      break;

    default:
      break;
  }
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  try {
    getRequiredEnv(stripeSecretKey, 'STRIPE_SECRET_KEY');
    getRequiredEnv(stripeWebhookSecret, 'STRIPE_WEBHOOK_SECRET');
    getRequiredEnv(supabaseUrl, 'SUPABASE_URL');
    getRequiredEnv(supabaseServiceRoleKey, 'SUPABASE_SERVICE_ROLE_KEY');

    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return jsonResponse({ error: 'Missing Stripe signature.' }, 400);
    }

    const payload = await request.text();
    const event = await stripe.webhooks.constructEventAsync(
      payload,
      signature,
      stripeWebhookSecret,
    );

    await handleStripeEvent(event);

    return jsonResponse({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Stripe webhook failed.';

    return jsonResponse({ error: message }, 400);
  }
});
