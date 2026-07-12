"use client";

import Header from "../components/Header";
import Gallery from "../components/Gallery";
import { useLanguage } from "../components/LanguageContext";

const pageTranslations = {
  tr: {
    eyebrow: "Kaş'ın Butik Şarküterisi",
    title: "Leman's Deli",
    heroDescription:
      "Günlük hazırlanan mezeler, seçkin yerel ve dünya peynirleri, kaliteli deli etleri ve özenle hazırlanan gurme sandviçler.",
    slogan: "İyi malzeme. Doğru tarif. Dürüst fiyat.",
    menuButton: "Tezgâhtan Seçmeler",
    directions: "Yol Tarifi",

    aboutEyebrow: "Biz Kimiz?",
    aboutTitle: "Kaş'ın merkezinde gerçek bir mahalle şarküterisi",
    about1:
      "Leman's Deli; iyi malzemenin, doğru tarifin ve özenle seçilmiş ürünlerin bir araya geldiği butik bir şarküteridir.",
    about2:
      "Tezgâhımızda Türkiye'nin farklı bölgelerinden yerel peynirleri, dünya klasiklerini, seçkin deli etlerini ve her gün taze hazırlanan mezeleri buluşturuyoruz.",
    about3:
      "Amacımız gösterişli değil, lezzetli ve dürüst bir deneyim sunmak. İster dükkânımızda, ister paket servis veya gel-al seçenekleriyle.",

    selectionEyebrow: "Leman's Deli",
    selectionTitle: "Tezgâhtan Seçmeler",
    selectionDescription:
      "Her gün yenilenen tezgâhımızdan, Leman's Deli'nin dört temel lezzet grubuna yakından bakın.",

    mezeNumber: "01",
    mezeTitle: "Günlük Mezeler",
    mezeText:
      "Her gün taze hazırlanan, sezon ve stok durumuna göre değişen en az on farklı meze. Humus, fava, mütebbel, muhammara, şakşuka, Girit ezme, haydari, deniz börülcesi, atom ve daha fazlası.",
    mezeNote: "Her gün taze • Sezona göre değişen seçki",

    cheeseNumber: "02",
    cheeseTitle: "Yerel & Dünya Peynirleri",
    cheeseText:
      "Erzincan, Bergama ve keçi tulumlarından Kars gravyeri, eski kaşar ve yağlı çeçile; Brie, Camembert, Danish Blue, Gouda, Edam, Parmigiano ve İrlanda cheddarına uzanan özenli bir peynir seçkisi.",
    cheeseNote: "Türkiye'den ve dünyadan seçilmiş peynirler",

    deliNumber: "03",
    deliTitle: "Seçkin Deli Etleri",
    deliText:
      "Dana kaburga füme, rozbif, Balkan tipi kuru et, jambon, mortadella, fermente sucuk, Macar salam, hindi füme, somon füme ve farklı sosis çeşitlerinden oluşan zengin bir şarküteri seçkisi.",
    deliNote: "Füme ürünler • Kuru etler • Şarküteri klasikleri",

    sandwichNumber: "04",
    sandwichTitle: "Gurme Sandviçler",
    sandwichText:
      "Kaliteli deli etleri, seçilmiş peynirler, taze ekmekler ve kendi hazırladığımız özel soslarla sipariş üzerine hazırlanan doyurucu sandviçler.",
    sandwichNote: "Sipariş üzerine taze hazırlanır",

    contactEyebrow: "Bize Ulaşın",
    contactTitle: "Leman's Deli'ye bekleriz",
    contactDescription:
      "Ürün bilgisi, sipariş ve paket servis için bize telefon, WhatsApp veya Instagram üzerinden ulaşabilirsiniz.",
    phone: "+90 530 700 57 04",
    email: "info@lemansdeli.com",
    instagramAccount: "@lemansdeli",
    hours: "Her gün 09:00 – 21:00",
    pet: "Evcil hayvan dostu",
    card: "Kredi kartı geçerlidir",
    delivery: "Paket servis ve gel-al mevcuttur",
    instagram: "Instagram",
    whatsapp: "WhatsApp",
    map: "Yol Tarifi",

    footerTagline: "Kaş'ın Butik Şarküterisi",
    rights: "Tüm hakları saklıdır.",
  },

  en: {
    eyebrow: "Kaş's Boutique Delicatessen",
    title: "Leman's Deli",
    heroDescription:
      "Freshly prepared meze, selected local and international cheeses, quality deli meats and carefully made gourmet sandwiches.",
    slogan: "Good ingredients. Proper recipes. Fair prices.",
    menuButton: "From the Counter",
    directions: "Get Directions",

    aboutEyebrow: "Our Story",
    aboutTitle: "A neighbourhood delicatessen in the heart of Kaş",
    about1:
      "Leman's Deli is a boutique delicatessen where good ingredients, proper recipes and carefully selected products come together.",
    about2:
      "Our counter brings together regional Turkish cheeses, international classics, selected deli meats and meze prepared fresh every day.",
    about3:
      "Our aim is simple: to offer a delicious, honest experience in our shop or through delivery and takeaway.",

    selectionEyebrow: "Leman's Deli",
    selectionTitle: "From the Counter",
    selectionDescription:
      "Discover the four main tastes that shape our counter and change with the rhythm of each day.",

    mezeNumber: "01",
    mezeTitle: "Fresh Meze",
    mezeText:
      "At least ten varieties prepared fresh every day and changing with the season and availability. Hummus, fava, mutabbal, muhammara, şakşuka, Girit spread, haydari, sea beans, atom and more.",
    mezeNote: "Prepared daily • Seasonal selection",

    cheeseNumber: "02",
    cheeseTitle: "Local & World Cheeses",
    cheeseText:
      "A carefully selected collection ranging from regional tulum, Kars Gruyère, aged kaşar and string cheese to Brie, Camembert, Danish Blue, Gouda, Edam, Parmigiano and Irish cheddar.",
    cheeseNote: "Selected cheeses from Türkiye and beyond",

    deliNumber: "03",
    deliTitle: "Selected Deli Meats",
    deliText:
      "Smoked beef rib, roast beef, Balkan-style cured beef, ham, mortadella, fermented sucuk, Hungarian salami, smoked turkey, smoked salmon and several sausage varieties.",
    deliNote: "Smoked meats • Cured meats • Deli classics",

    sandwichNumber: "04",
    sandwichTitle: "Gourmet Sandwiches",
    sandwichText:
      "Generous sandwiches made to order with quality deli meats, selected cheeses, fresh bread and our house-made signature sauces.",
    sandwichNote: "Freshly prepared to order",

    contactEyebrow: "Visit Us",
    contactTitle: "Welcome to Leman's Deli",
    contactDescription:
      "Contact us by phone, WhatsApp or Instagram for product information, orders and delivery.",
    phone: "+90 530 700 57 04",
    email: "info@lemansdeli.com",
    instagramAccount: "@lemansdeli",
    hours: "Open daily 09:00 – 21:00",
    pet: "Pet friendly",
    card: "Credit cards accepted",
    delivery: "Delivery and takeaway available",
    instagram: "Instagram",
    whatsapp: "WhatsApp",
    map: "Get Directions",

    footerTagline: "Kaş's Boutique Delicatessen",
    rights: "All rights reserved.",
  },

  ru: {
    eyebrow: "Бутик-деликатесы в Каше",
    title: "Leman's Deli",
    heroDescription:
      "Свежие мезе, отборные местные и зарубежные сыры, качественные мясные деликатесы и авторские сэндвичи.",
    slogan: "Хорошие продукты. Правильные рецепты. Честные цены.",
    menuButton: "С витрины",
    directions: "Как добраться",

    aboutEyebrow: "О нас",
    aboutTitle: "Настоящий гастроном в самом центре Каша",
    about1:
      "Leman's Deli — бутик деликатесов, где встречаются хорошие продукты, правильные рецепты и тщательно отобранный ассортимент.",
    about2:
      "На нашей витрине представлены региональные турецкие сыры, мировая классика, мясные деликатесы и свежие мезе.",
    about3:
      "Наша цель проста: предложить вкусный и честный опыт в магазине, с доставкой или навынос.",

    selectionEyebrow: "Leman's Deli",
    selectionTitle: "С витрины",
    selectionDescription:
      "Познакомьтесь с четырьмя основными направлениями нашей витрины, которая обновляется каждый день.",

    mezeNumber: "01",
    mezeTitle: "Свежие мезе",
    mezeText:
      "Не менее десяти видов мезе, которые ежедневно готовятся и меняются в зависимости от сезона. Хумус, фава, мутаббаль, мухаммара, шакшука, хайдари, морская спаржа, атом и многое другое.",
    mezeNote: "Готовим ежедневно • Сезонный выбор",

    cheeseNumber: "02",
    cheeseTitle: "Местные и мировые сыры",
    cheeseText:
      "От региональных тулумов, карского грюйера, выдержанного кашара и чечила до Brie, Camembert, Danish Blue, Gouda, Edam, Parmigiano и ирландского чеддера.",
    cheeseNote: "Отборные сыры из Турции и других стран",

    deliNumber: "03",
    deliTitle: "Мясные деликатесы",
    deliText:
      "Копчёные говяжьи рёбра, ростбиф, вяленая говядина, ветчина, мортаделла, ферментированный суджук, венгерская салями, копчёная индейка, копчёный лосось и колбаски.",
    deliNote: "Копчёности • Вяленое мясо • Классика гастронома",

    sandwichNumber: "04",
    sandwichTitle: "Авторские сэндвичи",
    sandwichText:
      "Сытные сэндвичи, приготовленные на заказ из качественных мясных деликатесов, отборных сыров, свежего хлеба и фирменных соусов.",
    sandwichNote: "Готовим свежими после заказа",

    contactEyebrow: "Связаться с нами",
    contactTitle: "Ждём вас в Leman's Deli",
    contactDescription:
      "Свяжитесь с нами по телефону, WhatsApp или Instagram для заказа и получения информации о продуктах.",
    phone: "+90 530 700 57 04",
    email: "info@lemansdeli.com",
    instagramAccount: "@lemansdeli",
    hours: "Ежедневно 09:00 – 21:00",
    pet: "Можно с животными",
    card: "Принимаем банковские карты",
    delivery: "Доставка и еда навынос",
    instagram: "Instagram",
    whatsapp: "WhatsApp",
    map: "Как добраться",

    footerTagline: "Бутик-деликатесы в Каше",
    rights: "Все права защищены.",
  },
};

export default function Home() {
  const { language } = useLanguage();
  const text = pageTranslations[language];

const selections = [
  {
    number: "01",
    title:
      language === "tr"
        ? "Yerel & Dünya Peynirleri"
        : language === "en"
          ? "Local & International Cheeses"
          : "Местные и мировые сыры",

    description:
      language === "tr"
        ? "Erzincan, Bergama ve Obruk keçi tulumlarından Malakan göbek kaşara, eski kaşardan Kars gravyerine uzanan zengin bir yerel peynir seçkisi sunuyoruz. Tezgâhımızda ayrıca Brie, Camembert, Danish Blue, Gouda, Edam, Parmigiano ve İrlanda cheddarı gibi dünya klasiklerini de bulabilirsiniz."
        : language === "en"
          ? "Our cheese counter features a rich selection ranging from regional Erzincan, Bergama and Obruk goat tulum cheeses to Malakan kaşar, aged kaşar and Kars Gruyère. We also offer international classics including Brie, Camembert, Danish Blue, Gouda, Edam, Parmigiano and Irish cheddar."
          : "На нашей сырной витрине представлены региональные сыры тулум из Эрзинджана, Бергамы и Обрука, сыр Малакан, выдержанный кашар и карский грюйер. Также вы найдёте Brie, Camembert, Danish Blue, Gouda, Edam, Parmigiano и ирландский чеддер.",

    note:
      language === "tr"
        ? "Tulumlar • Kars peynirleri • Dünya klasikleri"
        : language === "en"
          ? "Tulum cheeses • Kars cheeses • International classics"
          : "Сыры тулум • Карские сыры • Мировая классика",

    image: "/cheese.jpg",
    imageAlt:
      language === "tr"
        ? "Leman's Deli yerel ve dünya peynirleri"
        : language === "en"
          ? "Local and international cheeses at Leman's Deli"
          : "Местные и мировые сыры в Leman's Deli",

    reverse: false,
  },

  {
    number: "02",
    title:
      language === "tr"
        ? "Seçkin Şarküteri Ürünleri"
        : language === "en"
          ? "Selected Delicatessen"
          : "Отборные мясные деликатесы",

    description:
      language === "tr"
        ? "Dana kaburga füme, rozbif, Balkan tipi kuru et, cotto tranç, Macar salam, dana jambon, mortadella ve fermente sucuk çeşitlerini bir araya getiriyoruz. Tezgâhımızda ayrıca hindi füme, somon füme ve Frankfurter, Bratwurst ve kokteyl sosis çeşitleri yer alıyor."
        : language === "en"
          ? "Our delicatessen selection includes smoked beef rib, roast beef, Balkan-style cured beef, cotto beef, Hungarian salami, beef ham, mortadella and fermented sucuk. We also offer smoked turkey, smoked salmon and Frankfurter, Bratwurst and cocktail sausages."
          : "В нашей витрине представлены копчёные говяжьи рёбра, ростбиф, вяленая говядина по-балкански, cotto, венгерская салями, говяжья ветчина, мортаделла и ферментированный суджук. Также есть копчёная индейка, копчёный лосось и колбаски Frankfurter, Bratwurst и коктейльные сосиски.",

    note:
      language === "tr"
        ? "Füme etler • Kuru etler • Salam ve sosis çeşitleri"
        : language === "en"
          ? "Smoked meats • Cured meats • Salami and sausages"
          : "Копчёности • Вяленое мясо • Салями и колбаски",

    image: "/charcuterie.jpg",
    imageAlt:
      language === "tr"
        ? "Leman's Deli şarküteri ürünleri"
        : language === "en"
          ? "Delicatessen selection at Leman's Deli"
          : "Мясные деликатесы в Leman's Deli",

    reverse: true,
  },

  {
    number: "03",
    title:
      language === "tr"
        ? "Günlük Mezeler"
        : language === "en"
          ? "Freshly Prepared Meze"
          : "Свежеприготовленные мезе",

    description:
      language === "tr"
        ? "Sezon ve stok durumuna göre her gün en az on farklı meze hazırlıyoruz. Humus, köpoğlu, fava, şakşuka, mütebbel, atom, Girit ezme, havuç tarator, muhammara, deniz börülcesi, haydari, kuru dolma, fellah köfte ve zeytinyağlılar günlük seçkimizin parçalarıdır."
        : language === "en"
          ? "We prepare at least ten different meze varieties every day, depending on the season and availability. Our changing selection may include hummus, köpoğlu, fava, şakşuka, mutabbal, atom, Girit spread, carrot tarator, muhammara, sea beans, haydari, stuffed dried vegetables, fellah köfte and olive-oil dishes."
          : "Каждый день мы готовим не менее десяти видов мезе в зависимости от сезона и наличия продуктов. В ассортимент могут входить хумус, кёпоглу, фава, шакшука, мутаббаль, атом, критская сырная закуска, морковный таратор, мухаммара, морская спаржа, хайдари, фаршированные сушёные овощи, феллах кёфте и блюда на оливковом масле.",

    note:
      language === "tr"
        ? "Her gün taze • Sezon ve stok durumuna göre değişir"
        : language === "en"
          ? "Prepared daily • Selection changes seasonally"
          : "Готовим ежедневно • Ассортимент меняется по сезону",

    image: "/meze.jpg",
    imageAlt:
      language === "tr"
        ? "Leman's Deli günlük mezeleri"
        : language === "en"
          ? "Freshly prepared meze at Leman's Deli"
          : "Свежие мезе в Leman's Deli",

    reverse: false,
  },
    {
      number: text.sandwichNumber,
      title: text.sandwichTitle,
      description: text.sandwichText,
      note: text.sandwichNote,
      image: "/gallery-4.jpg",
      imageAlt: text.sandwichTitle,
      reverse: true,
    },
  ];

  return (
    <main className="min-h-screen overflow-hidden bg-[#f5efe7] text-[#2a1711]">
      <Header />

      {/* HERO */}
      <section
        id="hero"
        className="relative min-h-screen overflow-hidden pt-[96px] lg:pt-[118px]"
      >
        <div className="absolute inset-0 bg-[#2b160f]" />

        <div className="relative mx-auto grid min-h-[calc(100vh-96px)] max-w-[1600px] lg:min-h-[calc(100vh-118px)] lg:grid-cols-[0.9fr_1.1fr]">
          <div className="relative z-10 flex items-center px-6 py-20 sm:px-10 lg:px-16 xl:px-24">
            <div className="max-w-xl text-[#fff6ea]">
              <p className="mb-6 text-xs uppercase tracking-[0.38em] text-[#e7b69c] sm:text-sm">
                {text.eyebrow}
              </p>

              <h1 className="font-serif text-6xl leading-[0.94] tracking-[-0.04em] sm:text-7xl lg:text-8xl xl:text-9xl">
                {text.title}
              </h1>

              <div className="my-8 h-px w-24 bg-[#b7471c]" />

              <p className="max-w-lg text-lg leading-8 text-[#fff6ea]/80 sm:text-xl">
                {text.heroDescription}
              </p>

              <p className="mt-7 font-serif text-2xl italic text-[#e7b69c] sm:text-3xl">
                {text.slogan}
              </p>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <a
                  href="#menu"
                  className="inline-flex items-center justify-center rounded-full bg-[#9a2e09] px-8 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-white transition duration-300 hover:-translate-y-1 hover:bg-[#b13b12]"
                >
                  {text.menuButton}
                </a>

                <a
                  href="https://maps.app.goo.gl/bmf25xzx2GC47bvCA"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-full border border-[#fff6ea]/45 px-8 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-[#fff6ea] transition duration-300 hover:border-[#fff6ea] hover:bg-[#fff6ea] hover:text-[#2b160f]"
                >
                  {text.directions}
                </a>
              </div>
            </div>
          </div>

          <div className="relative min-h-[480px] lg:min-h-full">
            <img
              src="/food-hero.jpg"
              alt="Leman's Deli şarküteri seçkisi"
              className="absolute inset-0 h-full w-full object-cover"
            />

            <div className="absolute inset-0 bg-gradient-to-r from-[#2b160f] via-[#2b160f]/20 to-transparent lg:block" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#2b160f]/50 via-transparent to-transparent" />
          </div>
        </div>
      </section>

      {/* HAKKIMIZDA */}
      <section id="about" className="px-6 py-24 sm:px-10 lg:py-32">
        <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <div className="relative">
            <div className="absolute -bottom-6 -left-6 hidden h-full w-full border border-[#922800]/25 lg:block" />

            <img
              src="/hero.jpg"
              alt="Leman's Deli dükkânı"
              className="relative z-10 h-[480px] w-full rounded-[2rem] object-cover shadow-2xl sm:h-[580px]"
            />
          </div>

          <div className="max-w-xl">
            <p className="mb-5 text-xs uppercase tracking-[0.34em] text-[#922800]">
              {text.aboutEyebrow}
            </p>

            <h2 className="font-serif text-4xl leading-tight sm:text-5xl lg:text-6xl">
              {text.aboutTitle}
            </h2>

            <div className="my-8 h-px w-20 bg-[#922800]" />

            <div className="space-y-6 text-lg leading-8 text-[#2a1711]/70">
              <p>{text.about1}</p>
              <p>{text.about2}</p>
              <p>{text.about3}</p>
            </div>
          </div>
        </div>
      </section>

      {/* TEZGÂHTAN SEÇMELER */}
      <section id="menu" className="bg-[#fffaf4] px-6 py-24 sm:px-10 lg:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto mb-20 max-w-3xl text-center">
            <p className="mb-5 text-xs uppercase tracking-[0.34em] text-[#922800]">
              {text.selectionEyebrow}
            </p>

            <h2 className="font-serif text-5xl sm:text-6xl">
              {text.selectionTitle}
            </h2>

            <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-[#2a1711]/65">
              {text.selectionDescription}
            </p>
          </div>

          <div className="space-y-20 lg:space-y-28">
            {selections.map((item) => (
              <article
                key={item.number}
                className="grid items-center gap-10 lg:grid-cols-2 lg:gap-20"
              >
                <div
                  className={`relative ${
                    item.reverse ? "lg:order-2" : "lg:order-1"
                  }`}
                >
                  <div className="absolute -inset-4 rounded-[2.25rem] border border-[#922800]/15" />

                  <div className="relative h-[380px] overflow-hidden rounded-[2rem] sm:h-[500px]">
                    <img
                      src={item.image}
                      alt={item.imageAlt}
                      className="h-full w-full object-cover transition duration-700 hover:scale-105"
                    />

                    <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
                  </div>
                </div>

                <div
                  className={`${
                    item.reverse ? "lg:order-1" : "lg:order-2"
                  }`}
                >
                  <p className="font-serif text-6xl text-[#922800]/20 sm:text-7xl">
                    {item.number}
                  </p>

                  <h3 className="-mt-4 font-serif text-4xl leading-tight sm:text-5xl">
                    {item.title}
                  </h3>

                  <div className="my-7 h-px w-20 bg-[#922800]" />

                  <p className="max-w-xl text-lg leading-8 text-[#2a1711]/70">
                    {item.description}
                  </p>

                  <p className="mt-7 text-xs uppercase tracking-[0.24em] text-[#922800]">
                    {item.note}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* GALERİ */}
      <Gallery />

      {/* İLETİŞİM */}
      <section id="contact" className="bg-[#2b160f] px-6 py-24 text-[#fff6ea] sm:px-10 lg:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto mb-14 max-w-3xl text-center">
            <p className="mb-5 text-xs uppercase tracking-[0.34em] text-[#e7b69c]">
              {text.contactEyebrow}
            </p>

            <h2 className="font-serif text-5xl sm:text-6xl">
              {text.contactTitle}
            </h2>

            <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-[#fff6ea]/65">
              {text.contactDescription}
            </p>
          </div>

          <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-2">
            <a
              href="tel:+905307005704"
              className="rounded-3xl border border-white/10 bg-white/5 p-7 transition hover:border-[#e7b69c]/50 hover:bg-white/10"
            >
              <p className="mb-2 text-xs uppercase tracking-[0.25em] text-[#e7b69c]">
                Telefon
              </p>
              <p className="text-xl">{text.phone}</p>
            </a>

            <a
              href="mailto:info@lemansdeli.com"
              className="rounded-3xl border border-white/10 bg-white/5 p-7 transition hover:border-[#e7b69c]/50 hover:bg-white/10"
            >
              <p className="mb-2 text-xs uppercase tracking-[0.25em] text-[#e7b69c]">
                E-mail
              </p>
              <p className="text-xl">{text.email}</p>
            </a>

            <a
              href="https://www.instagram.com/lemansdeli"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-3xl border border-white/10 bg-white/5 p-7 transition hover:border-[#e7b69c]/50 hover:bg-white/10"
            >
              <p className="mb-2 text-xs uppercase tracking-[0.25em] text-[#e7b69c]">
                Instagram
              </p>
              <p className="text-xl">{text.instagramAccount}</p>
            </a>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-7">
              <p className="mb-2 text-xs uppercase tracking-[0.25em] text-[#e7b69c]">
                Saatler
              </p>
              <p className="text-xl">{text.hours}</p>
            </div>
          </div>

          <div className="mx-auto mt-5 grid max-w-5xl gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-center text-white/70">
              {text.pet}
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-center text-white/70">
              {text.card}
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-center text-white/70">
              {text.delivery}
            </div>
          </div>

          <div className="mt-12 flex flex-col justify-center gap-4 sm:flex-row">
            <a
              href="https://www.instagram.com/lemansdeli"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-[#922800] px-8 py-4 text-center text-sm font-semibold uppercase tracking-[0.12em] text-white transition hover:-translate-y-1 hover:bg-[#ad3810]"
            >
              {text.instagram}
            </a>

            <a
              href="https://wa.me/905307005704"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-[#fff6ea]/35 px-8 py-4 text-center text-sm font-semibold uppercase tracking-[0.12em] transition hover:border-white hover:bg-white hover:text-[#2b160f]"
            >
              {text.whatsapp}
            </a>

            <a
              href="https://maps.app.goo.gl/bmf25xzx2GC47bvCA"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-[#fff6ea]/35 px-8 py-4 text-center text-sm font-semibold uppercase tracking-[0.12em] transition hover:border-white hover:bg-white hover:text-[#2b160f]"
            >
              {text.map}
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/10 bg-[#1c0d09] px-6 py-10 text-[#fff6ea]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 text-center md:flex-row md:text-left">
          <div>
            <p className="font-serif text-2xl">Leman&apos;s Deli</p>
            <p className="mt-1 text-sm text-white/45">
              {text.footerTagline}
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-sm text-white/60">
            <a
              href="https://www.instagram.com/lemansdeli"
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-white"
            >
              Instagram
            </a>

            <a
              href="https://wa.me/905307005704"
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-white"
            >
              WhatsApp
            </a>

            <a
              href="https://maps.app.goo.gl/bmf25xzx2GC47bvCA"
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-white"
            >
              Google Maps
            </a>
          </div>

          <p className="text-xs text-white/35">
            © {new Date().getFullYear()} Leman&apos;s Deli. {text.rights}
          </p>
        </div>
      </footer>
    </main>
  );
}