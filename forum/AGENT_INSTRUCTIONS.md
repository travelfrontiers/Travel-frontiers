# Forum Post Generation Guide (For Autonomous Agents)

This guide defines how an AI agent can create and publish high-quality, multilingual travel posts directly to the **Travel Frontiers Forum**.

---

## 📁 Architecture Overview

To publish a post, an agent needs to create only **1 content JSON file**, **1 image file**, and prepend the summary entry to `index.json`:

```text
forum/
├── posts/
│   ├── index.json               <-- Append/prepend summary object here
│   └── <post-id>.json           <-- Full post content + multilingual translations
└── img/
    └── <post-id>.png            <-- 16:9 banner image
```

> ⚡ **No code changes required**: The forum UI automatically loads posts from `forum/posts/index.json` and loads comments dynamically (no empty comment boilerplate file needed).

---

## 📝 Step 1: Create `forum/posts/<post-id>.json`

File path: `forum/posts/<post-id>.json` (e.g. `forum/posts/rome-food-guide.json`)

```json
{
  "id": "rome-food-guide",
  "title": "Rome Food Guide - What & Where to Eat Like a Roman",
  "title_pt": "Guia Gastronómico de Roma - O Que e Onde Comer Como um Romano",
  "title_fr": "Guide Gastronomique de Rome - Quoi et Où Manger Comme un Romain",
  "destination": "Italy",
  "category": "restaurants",
  "author": "Tiago Ferreira",
  "date": "2026-04-12",
  "readTime": "6 min read",
  "readTime_pt": "6 min de leitura",
  "readTime_fr": "6 min de lecture",
  "thumbnail": "./img/rome-food-guide.png",
  "excerpt": "Experience authentic Roman cuisine: the best pasta, traditional trattorias, and hidden street food spots.",
  "excerpt_pt": "Descubra a autêntica gastronomia romana: as melhores massas, trattorias tradicionais e street food imperdível.",
  "excerpt_fr": "Découvrez la cuisine romaine authentique : les meilleures pâtes, trattorias traditionnelles et street food incontournable.",
  "content": "<h2>Introduction</h2><p>Roman cuisine is rustic, rich, and unforgettable...</p><h2>Top Pasta Dishes</h2><p>Don't leave without tasting authentic Carbonara and Cacio e Pepe...</p>",
  "content_pt": "<h2>Introdução</h2><p>A cozinha romana é autêntica, rica e inesquecível...</p><h2>Pratos de Massa Imperdíveis</h2><p>Não saia sem provar a verdadeira Carbonara e Cacio e Pepe...</p>",
  "content_fr": "<h2>Introduction</h2><p>La cuisine romaine est authentique, riche et inoubliable...</p><h2>Les Pâtes Incontournables</h2><p>Ne partez pas sans goûter l'authentique Carbonara et Cacio e Pepe...</p>",
  "likes": 0,
  "affiliateLink": {
    "text": "Book a Rome Street Food Tour on Viator",
    "text_pt": "Reserve um Street Food Tour em Roma no Viator",
    "text_fr": "Réservez un Food Tour à Rome sur Viator",
    "url": "https://www.viator.com/?pid=P00279385&mcid=42383&medium=link",
    "type": "viator"
  },
  "cta": {
    "text": "Want a personalized Rome itinerary with curated restaurant bookings?",
    "text_pt": "Quer um itinerário personalizado para Roma com reservas nos melhores restaurantes?",
    "text_fr": "Vous souhaitez un itinéraire personnalisé à Rome avec réservations de restaurants ?",
    "button": "Request a custom plan",
    "button_pt": "Pedir plano personalizado",
    "button_fr": "Demander un plan sur-mesure",
    "link": "https://www.travelfrontiers.pt/#contact"
  },
  "relatedPosts": ["malta-best-restaurants"],
  "tags": ["rome", "food", "restaurants", "italy", "local-tips"]
}
```

### Allowed Categories:
- `destinos` (Destinations / Destinos)
- `restaurants` (Restaurants / Restaurantes)
- `dicas` (Travel Tips / Dicas de Viagem)
- `atividades` (Activities & Hiking / Atividades)

---

## 🖼️ Step 2: Add Image `forum/img/<post-id>.png`
- Use 16:9 aspect ratio (e.g. 1200x675 or 1024x576).
- Save inside `forum/img/<post-id>.png`.

---

## 📋 Step 3: Add to `forum/posts/index.json`
Prepend the summary object to the array in `forum/posts/index.json`:

```json
[
  {
    "id": "rome-food-guide",
    "title": "Rome Food Guide - What & Where to Eat Like a Roman",
    "title_pt": "Guia Gastronómico de Roma - O Que e Onde Comer Como um Romano",
    "title_fr": "Guide Gastronomique de Rome - Quoi et Où Manger Comme un Romain",
    "destination": "Italy",
    "category": "restaurants",
    "author": "Tiago Ferreira",
    "date": "2026-04-12",
    "readTime": "6 min read",
    "readTime_pt": "6 min de leitura",
    "readTime_fr": "6 min de lecture",
    "thumbnail": "./img/rome-food-guide.png",
    "excerpt": "Experience authentic Roman cuisine: the best pasta, traditional trattorias, and hidden street food spots.",
    "excerpt_pt": "Descubra a autêntica gastronomia romana: as melhores massas, trattorias tradicionais e street food imperdível.",
    "excerpt_fr": "Découvrez la cuisine romaine authentique : les melhores pâtes, trattorias traditionnelles e street food incontournable.",
    "likes": 0,
    "tags": ["rome", "food", "restaurants", "italy", "local-tips"]
  },
  ...
]
```

---

## 🤖 Automating with Script (Optional Helper)

You can also run this one-line command to auto-rebuild `forum/posts/index.json` from all individual post files:

```bash
node -e '
const fs = require("fs");
const path = "./forum/posts";
const files = fs.readdirSync(path).filter(f => f.endsWith(".json") && f !== "index.json");
const posts = files.map(f => {
  const d = JSON.parse(fs.readFileSync(path + "/" + f, "utf-8"));
  return {
    id: d.id, title: d.title, title_pt: d.title_pt, title_fr: d.title_fr,
    destination: d.destination, category: d.category, author: d.author,
    date: d.date, readTime: d.readTime, readTime_pt: d.readTime_pt, readTime_fr: d.readTime_fr,
    thumbnail: d.thumbnail, excerpt: d.excerpt, excerpt_pt: d.excerpt_pt, excerpt_fr: d.excerpt_fr,
    likes: d.likes || 0, tags: d.tags || []
  };
}).sort((a, b) => new Date(b.date) - new Date(a.date));
fs.writeFileSync("./forum/posts/index.json", JSON.stringify(posts, null, 2));
'
```
