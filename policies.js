/* Mishri Sweet House. Shop policies, rendered by build.js into
   policies/<slug>/index.html with the site's header and footer.

   Written from what the site already promises (delivery times and fees,
   payment methods, free replacement, the services it runs on). Terms the
   site did not state before are marked "Confirm" in README.md: check them
   against how the shop really works before activating Razorpay.

   Each section is [heading, [paragraphs]]. Paragraphs are plain text; a
   paragraph that is an array becomes a bulleted list. */

const UPDATED = "24 September 2026";
const SHOP = "Mishri Sweet House";
const ADDRESS = "14 Johari Bazaar Road, Jaipur 302003, Rajasthan, India";
const WHATSAPP = "+91 87446 67777";

const POLICIES = [
  {
    slug: "shipping",
    title: "Shipping and delivery",
    lede: "Where we deliver, how long it takes and what it costs.",
    sections: [
      ["Where we deliver", [
        "We deliver anywhere in India. Enter your PIN code at checkout and we tell you when your order will arrive.",
      ]],
      ["How long it takes", [
        [
          "Jaipur (PIN codes starting 302 and 303): same day, by evening.",
          "Everywhere else in India: 2 to 5 days from dispatch.",
        ],
        "Every sweet is made fresh on the morning it is dispatched, not taken from stock. Festival pre-orders and bulk orders such as the Wedding Favour are made in the days before your date; we confirm the delivery date with you when you order.",
        "Delivery times are our best estimate. Weather, courier delays and public holidays can occasionally add a day.",
      ]],
      ["What it costs", [
        "Delivery is free on orders over ₹999. Below that it is ₹79 per order, shown in your basket before you pay.",
      ]],
      ["Chilled sweets", [
        "Chilled sweets such as Rasmalai travel in an insulated box with ice packs. Refrigerate them as soon as they arrive.",
      ]],
      ["On the day", [
        "The rider calls the mobile number you gave at checkout, so please keep it reachable. If nobody is available, the courier will try to reach you again or return the parcel to us; we'll contact you on WhatsApp to arrange redelivery.",
        "You can check where your order is on the Track your order page, using your order number and mobile number.",
      ]],
    ],
  },
  {
    slug: "refunds",
    title: "Refunds and cancellations",
    lede: "What happens if something goes wrong, or you change your mind.",
    sections: [
      ["Broken, spoilt or late", [
        "If your order arrives damaged, spoilt or late, we replace it free, no questions. Message us on WhatsApp at " + WHATSAPP + " within 24 hours of delivery with your order number, and a photo if the box is damaged. If we can't replace it, we refund you in full.",
      ]],
      ["Cancelling an order", [
        "You can cancel free of charge until we start preparing your order. Message us on WhatsApp with your order number.",
        "Once your order is being prepared or is out for delivery we can't cancel it, because the sweets are made fresh for you and can't be resold.",
        "For bulk and wedding orders, which are made to order, cancellation terms are agreed with you when you place the order.",
      ]],
      ["How refunds are paid", [
        [
          "Paid online (UPI or card): refunded to the same account or card within 5 to 7 working days of us approving the refund. Your bank may take a little longer to show it.",
          "Cash on delivery: refunded by UPI or bank transfer to details you give us.",
        ],
      ]],
      ["Returns", [
        "Because sweets are perishable food, we can't take back an order that arrived in good condition.",
      ]],
    ],
  },
  {
    slug: "privacy",
    title: "Privacy policy",
    lede: "What we collect, why, and who else sees it.",
    sections: [
      ["What we collect", [
        [
          "When you order: your name, mobile number, delivery address, city and PIN code, the message for your card, and your email if you choose to give it.",
          "When you sign up for festival-box news: your email address.",
          "When you pay online: Razorpay handles your card or UPI details. We never see or store them; we only receive a payment reference.",
          "When you browse: your basket, wishlist and light or dark theme are kept in your own browser, not sent to us.",
        ],
      ]],
      ["Why we use it", [
        [
          "To prepare, deliver and support your order, including calling you on the day of delivery.",
          "To email you an order confirmation and a note when your order is out for delivery, if you gave your email.",
          "To email you about festival boxes, only if you signed up for them.",
        ],
        "We don't sell your details, and we don't use them for anything else.",
      ]],
      ["Who else handles it", [
        "We use a few service providers to run the shop. They process your details only to provide their service to us:",
        [
          "Vercel: hosts this website.",
          "Upstash: stores orders and the festival-box list.",
          "Razorpay: processes online payments.",
          "Resend: sends our emails.",
          "Our delivery partners: receive your name, phone number and address to deliver your order.",
        ],
      ]],
      ["Analytics and cookies", [
        "We use Vercel Web Analytics and Speed Insights to count page visits and measure how fast pages load. They don't use cookies and don't identify you. The site sets no advertising or tracking cookies. If you sign in to the shop admin, a sign-in cookie is set for that purpose only.",
      ]],
      ["How long we keep it", [
        "We keep order details for as long as we need them for the order, customer support and our accounts and tax records. Festival-box emails stop as soon as you unsubscribe, using the link in any of them, and your address is removed from the list.",
      ]],
      ["Your choices", [
        "You can ask to see, correct or delete the details we hold about you by messaging us on WhatsApp at " + WHATSAPP + ". Some order records must be kept for tax purposes even after you ask us to delete them.",
      ]],
    ],
  },
  {
    slug: "terms",
    title: "Terms and conditions",
    lede: "The terms that apply when you order from us.",
    sections: [
      ["About us", [
        SHOP + " is a sweet shop at " + ADDRESS + ". By placing an order on this website you agree to these terms.",
      ]],
      ["Prices and payment", [
        "All prices are in Indian rupees and include applicable taxes. The price you pay is the one shown at checkout. You can pay by UPI, debit or credit card (processed securely by Razorpay), or cash on delivery.",
        "Your order is confirmed when you see the order number on screen. For online payments, it is confirmed once the payment succeeds.",
      ]],
      ["Availability", [
        "Everything is made fresh in small batches, so items can sell out. If something in your order becomes unavailable after you order, we'll contact you to offer a replacement or a refund for that item.",
      ]],
      ["Delivery, cancellations and refunds", [
        "Delivery is covered by our Shipping and delivery policy, and cancellations and refunds by our Refunds and cancellations policy. Both form part of these terms.",
      ]],
      ["Allergens and storage", [
        "Our sweets are made in a kitchen that handles milk, nuts (including cashew, pistachio and almond), gram flour, wheat and sugar. If you have an allergy, please ask us before ordering. Please follow the storage advice on each product; we can't be responsible for sweets kept in other conditions after delivery.",
      ]],
      ["Photos", [
        "Photos show our sweets as closely as we can, but each batch is made by hand and may look slightly different.",
      ]],
      ["Liability", [
        "If something goes wrong with your order, our responsibility is limited to replacing the order or refunding what you paid for it.",
      ]],
      ["Law", [
        "These terms are governed by the laws of India. Any dispute is subject to the courts in Jaipur, Rajasthan.",
      ]],
      ["Changes", [
        "We may update these terms. The version on this page when you place an order is the one that applies to it.",
      ]],
    ],
  },
  {
    slug: "contact",
    title: "Contact us",
    lede: "A person answers, usually within a few hours.",
    sections: [
      ["WhatsApp", [
        "The fastest way to reach us, for orders, bulk and wedding enquiries, or anything that went wrong: " + WHATSAPP + ".",
      ]],
      ["Visit or write", [
        SHOP + ", " + ADDRESS + ".",
      ]],
      ["About an order", [
        "Please include your order number (it starts with MSH). You can also check its status yourself on the Track your order page.",
      ]],
    ],
  },
];

module.exports = { POLICIES, UPDATED, WHATSAPP };
