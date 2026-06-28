const fs = require("fs");

const file = "src/components/modals/BeatBoxCart.tsx";

let code = fs.readFileSync(file, "utf8");

const oldBlock = `  const startStripeCheckout = async () => {
    const checkoutItems = cart.map((beat) => ({
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
  };`;

const newBlock = `  const startStripeCheckout = async () => {
    const checkoutUrl = 'https://buy.stripe.com/3cI7sM9Un83mfYT2gnbEA0y';

    await insertManualOrders();
    clearCart();
    window.location.assign(checkoutUrl);
  };`;

if (!code.includes(oldBlock)) {
  console.error("Exact BeatBoxCart checkout block not found. File was not changed.");
  process.exit(1);
}

code = code.replace(oldBlock, newBlock);
fs.writeFileSync(file, code);

console.log("BeatBoxCart.tsx fixed.");
