"use client";

import { useLanguage } from "./LanguageContext";

const productTranslations = {
  tr: {
    eyebrow: "LEMAN'S DELI",
    title: "Lezzetlerimiz",
    description:
      "Günlük hazırlanan mezeler, yerel ve dünya peynirleri, kaliteli deli etleri ve özenle hazırlanan gurme sandviçler... Leman's Deli'de her ürün aynı anlayışla hazırlanır.",

    charcuterie: "Şarküteri",
    charcuterieText:
      "Özenle seçilmiş peynirler, deli etleri, zeytinler ve eşlikçiler.",

    meze: "Günlük Mezeler",
    mezeText:
      "Her gün taze hazırlanan klasik ve mevsimlik meze çeşitleri.",

    sandwiches: "Gurme Sandviçler",
    sandwichesText:
      "Özel soslar, kaliteli malzemeler ve günlük ekmeklerle hazırlanır.",

    cheeses: "Seçkin Peynirler",
    cheesesText:
      "Türkiye'nin yerel peynirleri ve özenle seçilmiş dünya peynirleri.",

    slogan: "İyi malzeme, doğru tarif, dürüst fiyat.",
  },

  en: {
    eyebrow: "LEMAN'S DELI",
    title: "Our Specialities",
    description:
      "Freshly prepared meze, local and international cheeses, quality deli meats and carefully prepared gourmet sandwiches... Every product at Leman's Deli is made with the same approach.",

    charcuterie: "Delicatessen",
    charcuterieText:
      "Carefully selected cheeses, deli meats, olives and accompaniments.",

    meze: "Fresh Meze",
    mezeText:
      "Classic and seasonal meze varieties prepared fresh every day.",

    sandwiches: "Gourmet Sandwiches",
    sandwichesText:
      "Prepared with signature sauces, quality ingredients and fresh bread.",

    cheeses: "Selected Cheeses",
    cheesesText:
      "Local Turkish cheeses and carefully selected cheeses from around the world.",

    slogan: "Great ingredients, proper recipes, fair prices.",
  },

  ru: {
    eyebrow: "LEMAN'S DELI",
    title: "Наши блюда",
    description:
      "Свежеприготовленные мезе, местные и зарубежные сыры, качественные мясные деликатесы и авторские сэндвичи... Каждый продукт в Leman's Deli готовится с одинаковой заботой.",

    charcuterie: "Деликатесы",
    charcuterieText:
      "Отборные сыры, мясные деликатесы, оливки и дополнения.",

    meze: "Свежие мезе",
    mezeText:
      "Классические и сезонные мезе, приготовленные ежедневно.",

    sandwiches: "Авторские сэндвичи",
    sandwichesText:
      "Фирменные соусы, качественные продукты и свежий хлеб.",

    cheeses: "Отборные сыры",
    cheesesText:
      "Местные турецкие сыры и тщательно отобранные сыры со всего мира.",

    slogan:
      "Хорошие продукты, правильные рецепты, честные цены.",
  },
};

export default function Products() {
  const { language } = useLanguage();
  const text = productTranslations[language];

  const products = [
    {
      icon: "🧀",
      title: text.charcuterie,
      description: text.charcuterieText,
    },
    {
      icon: "🥣",
      title: text.meze,
      description: text.mezeText,
    },
    {
      icon: "🥪",
      title: text.sandwiches,
      description: text.sandwichesText,
    },
    {
      icon: "🍇",
      title: text.cheeses,
      description: text.cheesesText,
    },
  ];

  return (
    <section id="menu" className="bg-[#F8F5EF] py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16 text-center">
          <p className="mb-3 text-sm uppercase tracking-[0.35em] text-zinc-500">
            {text.eyebrow}
          </p>

          <h2 className="mb-6 text-5xl font-bold text-zinc-900">
            {text.title}
          </h2>

          <p className="mx-auto max-w-3xl text-lg leading-8 text-zinc-600">
            {text.description}
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4">
          {products.map((item) => (
            <div
              key={item.title}
              className="rounded-3xl bg-white p-8 shadow-lg transition duration-300 hover:-translate-y-2 hover:shadow-2xl"
            >
              <div className="mb-5 text-5xl">{item.icon}</div>

              <h3 className="mb-4 text-2xl font-bold">
                {item.title}
              </h3>

              <p className="leading-7 text-zinc-600">
                {item.description}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-20 text-center">
          <p className="text-2xl font-semibold italic text-zinc-700">
            “{text.slogan}”
          </p>
        </div>
      </div>
    </section>
  );
}