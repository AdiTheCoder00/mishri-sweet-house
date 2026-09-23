// Product catalogue for the Mishri demo store.
// Prices are in INR per box. Images live in ./images (fetched once from loremflickr keyword search).
const PRODUCTS = [
  {
    id: "kaju-katli",
    name: "Kaju Katli",
    category: "Barfi",
    price: 649,
    weight: "500 g",
    tag: "Bestseller",
    desc: "Thin diamonds of cashew and sugar, finished with edible silver leaf. Melts before you finish the bite.",
    story:
      "Kaju Katli is the sweet people judge a shop by, because there is nowhere to hide. Cashews, sugar, a little ghee. Nothing else to carry it. We soak the cashews, grind them to a paste that runs smooth between the fingers with no grain left, and cook it with sugar syrup until the mixture pulls cleanly away from the sides of the kadhai. That moment is the whole skill: a minute early and it stays sticky, a minute late and it turns crumbly and dull. It is rolled while still warm, thin enough that the surface takes a sheen, then laid with edible silver leaf and cut on the diagonal into the diamonds everyone recognises. Ours is lightly sweetened on purpose. A good katli should taste of cashew first and sugar second, and it should give way the moment it touches your tongue rather than needing to be chewed. It is the box most people send to a house where they do not know the tastes yet, because almost nobody refuses it.",
    img: "images/kaju-katli.webp",
  },
  {
    id: "gulab-jamun",
    name: "Gulab Jamun",
    category: "Syrup",
    price: 349,
    weight: "12 pieces",
    tag: "",
    desc: "Khoya dumplings fried slow and soaked in rose and cardamom syrup. Served warm at the counter.",
    story:
      "Gulab Jamun is a warm sweet, and most of what goes wrong with it happens after it leaves the kitchen. We make the dough from khoya reduced the same morning, worked with a little flour until it is soft and holds together without cracking at the edges, then rolled into balls with no seams. Seams split in the oil. They fry slowly on a low flame so the colour comes up evenly to a deep brown and the centre cooks through; rushed on high heat they darken outside and stay raw in the middle. Straight from the oil they go into warm sugar syrup scented with cardamom and rose, where they sit and drink until they double in softness. You get twelve pieces in their syrup. Warm them gently before serving, in the syrup rather than out of it, and they come back close to how they left us. They are best the day they arrive and perfectly good the day after.",
    img: "images/gulab-jamun.webp",
  },
  {
    id: "rasmalai",
    name: "Rasmalai",
    category: "Bengali",
    price: 429,
    weight: "8 pieces",
    tag: "Chilled",
    desc: "Soft chenna discs resting in saffron milk, topped with pistachio. Keep cold, eat within two days.",
    story:
      "Rasmalai is two things made separately and brought together at the end. First the chenna: whole milk split with a little acid, drained, then kneaded on the counter until the grain disappears and it turns smooth and pliable. Those discs are simmered in light syrup until they swell and turn spongy. Second the rabri: milk reduced slowly over a low flame, stirred so it never catches, sweetened lightly and finished with saffron until it thickens and turns the colour of old ivory. The discs are pressed gently to release the syrup, then rested in the saffron milk for several hours so they drink it all the way to the centre. We top them with pistachio. This is the most fragile thing we send. It travels in an insulated box with ice packs, it wants a fridge the moment it arrives, and it should be eaten within two days. Serve it cold, with some of the milk spooned over.",
    img: "images/rasmalai.webp",
  },
  {
    id: "motichoor-ladoo",
    name: "Motichoor Ladoo",
    category: "Ladoo",
    price: 399,
    weight: "500 g",
    tag: "",
    desc: "Tiny boondi pearls bound with ghee and sugar. The one that shows up at every celebration.",
    story:
      "The name means pearls, crushed, and that is the whole method. Besan batter is poured through a perforated ladle into hot ghee so it breaks into droplets the size of seed pearls, each one frying for only seconds. Get the batter too thick and they come out as lumps; too thin and they scatter into threads. The boondi is lifted out, soaked briefly in sugar syrup, then crushed lightly so the pearls give a little and bind, and rolled by hand while still warm. Rolled cold they refuse to hold. A motichoor ladoo should feel dense in the hand but collapse into separate grains in the mouth, which is what separates it from a plain boondi ladoo where the pearls stay whole and distinct. This is the sweet that shows up at every occasion worth marking, from a new house to a passed exam, and it is the one most often ordered by the kilo.",
    img: "images/motichoor-ladoo.webp",
  },
  {
    id: "pista-barfi",
    name: "Pista Barfi",
    category: "Barfi",
    price: 749,
    weight: "500 g",
    tag: "Premium",
    desc: "Ground Iranian pistachio and milk solids pressed into a dense green slab. No colour added.",
    story:
      "The colour here is the giveaway. Pista barfi made with real pistachio is a soft, dusty green that looks almost grey in poor light, nothing like the bright emerald you see when colour has been added. Ours is ground pistachio and milk solids, cooked down with sugar until it is dense enough to press into a tray, then cut into slabs. No colour goes in, so what you see is what the nut gives. Pistachio is the expensive part and there is no way to fake it that a regular customer will not taste, so this is the costliest thing on the counter by weight. It is richer and heavier than cashew barfi, more of a two-piece sweet than a five-piece one. Keep it in a cool dry place rather than the fridge, which dries the cut edges and dulls the flavour. It travels well, which makes it a good choice for a box going a long way.",
    img: "images/pista-barfi.webp",
  },
  {
    id: "mysore-pak",
    name: "Mysore Pak",
    category: "Ghee",
    price: 449,
    weight: "500 g",
    tag: "",
    desc: "Besan, sugar and a generous amount of ghee, cooked until it crumbles on the tongue.",
    story:
      "Mysore Pak is besan, sugar and a quantity of ghee that alarms people the first time they see it made. The ghee is not a cooking medium here, it is an ingredient: it goes in hot, in stages, and the besan drinks it until the mixture turns glossy and begins to froth. That froth is what you are waiting for, because it is the air that gives the finished block its honeycomb. Poured out and cut while warm, it sets into something that holds its shape on the plate and then crumbles the moment you bite it. There is a firmer, denser style of mysore pak sold in some places; ours is the porous kind, lighter than it looks. It keeps well for several days in an airtight box in a cool dry place. People who grew up with it tend to be particular about which kind they want, and this is the one that dissolves.",
    img: "images/mysore-pak.webp",
  },
  {
    id: "jalebi",
    name: "Jalebi",
    category: "Syrup",
    price: 249,
    weight: "400 g",
    tag: "Made to order",
    desc: "Crisp fermented batter spirals dipped in warm saffron syrup. Best eaten the same day.",
    story:
      "Jalebi is the only thing we make that we would rather you ate standing at the counter. The batter is fermented overnight, which is where the faint sourness comes from that keeps the whole thing from being merely sweet. It is piped into hot ghee in coils, fried until it is crisp and holds its shape, then dropped straight into warm saffron syrup for a few seconds only. Longer than that and it goes soft. The result should shatter slightly when you bite it, then flood. Because that crispness is the entire point and it begins to go within hours, we make jalebi to order rather than in advance, and we recommend eating it the same day it arrives. It does not keep, and reheating does not bring it back. If you are ordering for a gathering, order it for the day of the gathering.",
    img: "images/jalebi.webp",
  },
  {
    id: "rasgulla",
    name: "Rasgulla",
    category: "Bengali",
    price: 329,
    weight: "12 pieces",
    tag: "",
    desc: "Spongy chenna balls in light sugar syrup. Cold, clean and not too sweet.",
    story:
      "A good rasgulla is judged by squeezing it. Press one gently and it should give up its syrup and then spring back to its shape; if it stays flat, the chenna was overworked or the syrup too heavy. We split whole milk the same morning, drain the chenna, and knead it until it is smooth but no further. The balls are simmered in light sugar syrup where they roughly double in size as they take on liquid, which is why they end up spongy rather than dense. Ours are on the less sweet side, because the syrup is meant to be light enough that you can eat several. They arrive cold in their syrup, twelve to a box, and should go into the fridge on arrival and be eaten within two days. Bengali sweets do not wait, and this one least of all.",
    img: "images/rasgulla.webp",
  },
  {
    id: "besan-ladoo",
    name: "Besan Ladoo",
    category: "Ladoo",
    price: 379,
    weight: "500 g",
    tag: "",
    desc: "Roasted gram flour, ghee and cardamom rolled by hand. Nutty, grainy, comforting.",
    story:
      "Besan ladoo lives or dies on the roasting, and the roasting cannot be rushed. Gram flour goes into ghee over a low flame and is stirred, more or less continuously, for a long time. It moves through pale yellow to sand to a deep golden brown, and the kitchen fills with a nutty smell that tells you it is close. Stop early and the ladoo tastes raw and chalky. Push too far and it turns bitter. Off the heat it is left to cool, then mixed with sugar and cardamom and rolled by hand. Sugar added while the mixture is hot melts and makes the ladoo heavy, so the wait matters. The texture is deliberately grainy, which is how besan ladoo is meant to be, and it is one of the sweets that improves over a day or two as the flavours settle. It keeps well in an airtight box.",
    img: "images/besan-ladoo.webp",
  },
  {
    id: "kalakand",
    name: "Kalakand",
    category: "Ghee",
    price: 499,
    weight: "500 g",
    tag: "",
    desc: "Soft, grainy squares of curdled milk and sugar, set overnight and cut by hand.",
    story:
      "Kalakand is a study in not smoothing things out. Milk is split at just the right moment and then cooked down with sugar while still grainy, so the finished sweet keeps a texture you can feel on the tongue rather than the glassy smoothness of a barfi. It is cooked in a wide pan so the moisture goes quickly and the milk caramelises a little at the edges, which is where the faint toffee note comes from. Poured out, rested until it sets, then cut into squares and finished with pistachio. Made well it is moist without being wet, and it should hold together when picked up but break easily. It is a milk sweet above all, so it tastes most of what the milk was, which is why we make it on the mornings the dairy delivery is best. Keep it cool and eat it within a few days.",
    img: "images/kalakand.webp",
  },
  {
    id: "moong-dal-halwa",
    name: "Moong Dal Halwa",
    category: "Ghee",
    price: 449,
    weight: "500 g",
    tag: "Winter special",
    desc: "Moong dal roasted slowly in ghee until it turns golden, then finished with saffron and almonds.",
    story:
      "This is the most labour we put into anything on the counter, and it is why it appears in winter. Moong dal is soaked, ground, and then roasted in ghee for the better part of an hour, stirred without stopping. There is a long stretch where it looks like nothing is happening and the mixture just sits there pale and pasty, and then it breaks: it loosens, the ghee separates out, and the colour goes deep gold. That is the point people give up before. Milk and sugar go in after, then saffron, and it is finished with almonds. Served warm it is rich enough that a small bowl is plenty. There is no shortcut and no way to make it in a hurry, which is why most shops only offer it in the cold months, and we do the same.",
    img: "images/moong-dal-halwa.webp",
  },
  {
    id: "kesar-peda",
    name: "Kesar Peda",
    category: "Barfi",
    price: 549,
    weight: "500 g",
    tag: "",
    desc: "Slow-cooked khoya pressed into saffron discs, each one stamped by hand.",
    story:
      "Peda is khoya, sugar and patience. The khoya is cooked down further until it darkens slightly and tightens, then worked with sugar and saffron while still warm so the colour goes right through rather than sitting on the surface. Each one is shaped by hand and pressed with a thumb, which is why no two in the box are quite identical and why the marks are not stamped. The saffron is added as strands bloomed in a little warm milk, not as powder, so you get an uneven bloom of colour and an aroma that comes up as you open the box. Peda is firmer than barfi and meant to be eaten slowly, a piece at a time with tea. It keeps for several days in a cool dry place and is one of the more forgiving sweets to send a long distance.",
    img: "images/kesar-peda.webp",
  },
];

// Rough serving guidance shown on cards. Demo values.
const SERVES = { "500 g": "serves 8 to 10", "400 g": "serves 6 to 8", "12 pieces": "serves 6", "8 pieces": "serves 4" };

const GIFT_BOXES = [
  {
    id: "box-diwali",
    name: "The Diwali Box",
    price: 1899,
    weight: "1.2 kg, 6 varieties",
    desc: "Kaju Katli, Pista Barfi, Motichoor Ladoo, Kesar Peda, Besan Ladoo and Kalakand in a wooden box.",
    story:
      "The Diwali Box is what we send when someone wants one box to cover a whole household with different tastes in it. Six varieties, 1.2 kg in total, in a wooden box: Kaju Katli and Pista Barfi for the people who want something restrained, Motichoor Ladoo and Besan Ladoo for the ones who want the traditional thing, Kesar Peda for tea, and Kalakand for whoever gets there first. Everything in it is a dry or set sweet, chosen deliberately so the box survives a journey and keeps for several days once it arrives. Add a handwritten card at checkout and we write it by hand and tuck it inside before the box is closed. It is our most ordered box in the fortnight before Diwali, and we make more of everything in it during that period, but we do not make it further in advance. It is packed from that morning's batches like everything else.",
    img: "images/box-diwali.webp",
  },
  {
    id: "box-office",
    name: "The Office Box",
    price: 1299,
    weight: "800 g, 4 varieties",
    desc: "Dry sweets only, so nothing melts on the desk. Feeds a team of ten.",
    story:
      "The Office Box solves a specific problem: sweets sent to a workplace sit on a desk for hours before anyone eats them, and half of what we make does not survive that. So this box contains dry sweets only. Nothing that melts, nothing that needs a fridge, nothing that leaks syrup into a keyboard. Four varieties, 800 g, enough to go round a team of about ten. It needs no plates and no cutlery, which matters more than it sounds when a box is opened in a meeting room. This is the one companies reorder each quarter, and for larger runs or a corporate order with your own card message on every box, message us on WhatsApp and we will work it out with you directly rather than through the basket.",
    img: "images/box-office.webp",
  },
  {
    id: "box-wedding",
    name: "The Wedding Favour",
    price: 249,
    weight: "4 pieces per box",
    minQty: 50,
    step: 10,
    desc: "Two Kaju Katli and two Kesar Peda in a small ribboned box. Minimum order of 50.",
    story:
      "The Wedding Favour is the small box that goes home with each guest, and at that scale the details matter more than the variety. Four pieces per box: two Kaju Katli and two Kesar Peda, both chosen because they keep well, travel upright without sticking together, and are the two sweets least likely to be refused by anybody. Each box is tied with a ribbon by hand. Minimum order is fifty boxes and they are made in multiples of ten, which is how we schedule the kitchen around a date. Give us as much notice as you can for a wedding, because these are made in the days before the event rather than held in stock, and tell us the date rather than the delivery day so we can work backwards from it.",
    img: "images/box-wedding.webp",
  },
];
