const fs = require("fs");

const file = "src/components/modals/BuyModal.tsx";
let code = fs.readFileSync(file, "utf8");

const oldBlock = `  const startStripeCheckout = async () => {
    const origin = window.location.origin;
    const { data, error } = await supabase.functions.invoke('stripe-checkout', {
      body: {
        beatId: beat.id,
        beatTitle: beat.title,
        beatThumbnail: beat.cover_art_url || null,
        buyerName: form.name.trim(),
        buyerEmail: form.email.trim().toLowerCase(),
        amount: price,
        successUrl: \`${origin}/?checkout=success\`,
        cancelUrl: \`${origin}/?checkout=cancelled\`,
      },
    });

    if (error) throw error;

    const checkoutUrl = typeof data?.url === 'string' ? data.url : '';

    if (!checkoutUrl) {
      throw new Error('Stripe checkout did not return a redirect URL.');
    }

    window.location.assign(checkoutUrl);
  };`;

const newBlock = `  const startStripeCheckout = async () => {
    const checkoutUrl = 'https://buy.stripe.com/3cI7sM9Un83mfYT2gnbEA0y';

    const { error } = await supabase.from('orders').insert({
      beat_id: beat.id,
      beat_name: beat.title,
      beat_thumbnail: beat.cover_art_url || null,
      buyer_name: form.name.trim(),
      buyer_email: form.email.trim().toLowerCase(),
      payment_method: 'Stripe Checkout',
      payment_destination: checkoutUrl,
      amount: price,
      status: 'Pending Verification',
      release_download: false,
      sold: false,
      admin_approved: false,
      payment_received: false,
    });

    if (error) throw error;

    window.location.assign(checkoutUrl);
  };`;

if (!code.includes(oldBlock)) {
  console.error("Exact BuyModal checkout block not found. File was not changed.");
  process.exit(1);
}

code = code.replace(oldBlock, newBlock);
fs.writeFileSync(file, code);

console.log("BuyModal.tsx fixed.");
