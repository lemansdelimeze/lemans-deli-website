"use client";

import { useLanguage } from "./LanguageContext";

const galleryTranslations = {
  tr: {
    eyebrow: "LEMAN'S DELI",
    title: "Dükkandan Kareler",
    description:
      "Kaş’taki dükkanımızdan, tezgahımızdan ve günlük hazırlıklarımızdan seçilmiş kareler.",
    image1: "Leman’s Deli iç mekân",
    image2: "Günlük hazırlanan mezeler",
    image3: "Şarküteri ve peynir seçkisi",
    image4: "Gurme sandviçler",
  },

  en: {
    eyebrow: "LEMAN'S DELI",
    title: "Inside Leman’s",
    description:
      "A selection of moments from our shop in Kaş, our counter and our daily preparations.",
    image1: "Leman’s Deli interior",
    image2: "Freshly prepared meze",
    image3: "Deli meats and cheese selection",
    image4: "Gourmet sandwiches",
  },

  ru: {
    eyebrow: "LEMAN'S DELI",
    title: "Наше пространство",
    description:
      "Кадры из нашего магазина в Каше, с витрины и ежедневных приготовлений.",
    image1: "Интерьер Leman’s Deli",
    image2: "Свежеприготовленные мезе",
    image3: "Мясные деликатесы и сыры",
    image4: "Авторские сэндвичи",
  },
};

export default function Gallery() {
  const { language } = useLanguage();
  const text = galleryTranslations[language];

  const galleryItems = [
    {
      src: "/gallery-1.jpg",
      alt: text.image1,
      label: text.image1,
      className: "md:col-span-2 md:row-span-2",
      imageHeight: "h-[360px] md:h-full",
    },
    {
      src: "/gallery-2.jpg",
      alt: text.image2,
      label: text.image2,
      className: "md:col-span-1 md:row-span-1",
      imageHeight: "h-[320px]",
    },
    {
      src: "/gallery-3.jpg",
      alt: text.image3,
      label: text.image3,
      className: "md:col-span-1 md:row-span-2",
      imageHeight: "h-[420px] md:h-full",
    },
    {
      src: "/gallery-4.jpg",
      alt: text.image4,
      label: text.image4,
      className: "md:col-span-1 md:row-span-1",
      imageHeight: "h-[320px]",
    },
  ];

  return (
    <section
      id="gallery"
      className="bg-[#f5efe7] px-6 py-24 sm:px-10 lg:py-32"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto mb-16 max-w-3xl text-center">
          <p className="mb-5 text-xs uppercase tracking-[0.34em] text-[#922800]">
            {text.eyebrow}
          </p>

          <h2 className="font-serif text-5xl leading-tight text-[#2a1711] sm:text-6xl">
            {text.title}
          </h2>

          <div className="mx-auto my-7 h-px w-20 bg-[#922800]" />

          <p className="mx-auto max-w-2xl text-lg leading-8 text-[#2a1711]/65">
            {text.description}
          </p>
        </div>

        <div className="grid auto-rows-[220px] gap-5 md:grid-cols-3 md:auto-rows-[220px]">
          {galleryItems.map((item) => (
            <figure
              key={item.src}
              className={`group relative overflow-hidden rounded-[2rem] bg-[#2a1711] shadow-lg ${item.className}`}
            >
              <img
                src={item.src}
                alt={item.alt}
                loading="lazy"
                className={`${item.imageHeight} w-full object-cover transition duration-700 ease-out group-hover:scale-105`}
              />

              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent opacity-80 transition duration-500 group-hover:opacity-95" />

              <figcaption className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-7">
                <p className="font-serif text-2xl leading-tight">
                  {item.label}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}