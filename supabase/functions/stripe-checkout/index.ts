import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function cleanAmount(value: unknown): number {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Invalid checkout amount.');
  }
  return Math.round(amount * 100);
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  try {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') || '';
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured.');
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-12-18.acacia',
      appInfo: {
        name: 'ThisBeatIzBananaz Beat Shop',
        version: '1.0.0',
      },
    });

    const body = await request.json();
    const origin = request.headers.get('origin') || '';

    const successUrl =
      typeof body.successUrl === 'string' && body.successUrl
        ? body.successUrl
        : `${origin}/?checkout=success`;

    const cancelUrl =
      typeof body.cancelUrl === 'string' && body.cancelUrl
        ? body.cancelUrl
        : `${origin}/?checkout=cancelled`;

    const buyerEmail =
      typeof body.buyerEmail === 'string'
        ? body.buyerEmail
        : typeof body.buyer_email === 'string'
          ? body.buyer_email
          : undefined;

    const items = Array.isArray(body.items)
      ? body.items
      : [
          {
            beat_id: body.beatId,
            beat_name: body.beatTitle,
            beat_thumbnail: body.beatThumbnail,
            amount: body.amount,
          },
        ];

    if (items.length === 0) {
      throw new Error('No checkout items provided.');
    }

    const lineItems = items.map((item: any) => {
      const title = String(item.beat_name || item.beatTitle || 'Beat License');
      const image = item.beat_thumbnail || item.beatThumbnail;

      return {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: cleanAmount(item.amount),
          product_data: {
            name: title,
            images: typeof image === 'string' && image.startsWith('http') ? [image] : [],
          },
        },
      };
    });

    const orderIds = items
      .map((item: any) => item.order_id || item.orderId)
      .filter(Boolean)
      .join(',');

    const beatIds = items
      .map((item: any) => item.beat_id || item.beatId)
      .filter(Boolean)
      .join(',');

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      customer_email: buyerEmail,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        source: String(body.source || 'beat_checkout'),
        order_ids: orderIds,
        beat_ids: beatIds,
        buyer_name: String(body.buyerName || body.buyer_name || ''),
        buyer_email: String(buyerEmail || ''),
      },
      payment_intent_data: {
        metadata: {
          order_ids: orderIds,
          beat_ids: beatIds,
        },
      },
    });

    return jsonResponse({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Stripe checkout failed.';
    return jsonResponse({ error: message }, 400);
  }
});
