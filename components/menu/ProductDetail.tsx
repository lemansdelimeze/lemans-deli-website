import Badge from "./Badge";

type DetailItem = {
  label: string;
  value: string;
};

type ProductDetailProps = {
  name: string;
  imageUrl?: string | null;
  description?: string | null;
  details?: DetailItem[];
  allergens?: string[];
  allergensTitle: string;
  noAllergenText: string;
};

const BRAND_FONT =
  '"American Typewriter", "Courier New", Courier, monospace';

export default function ProductDetail({
  name,
  imageUrl,
  description,
  details = [],
  allergens = [],
  allergensTitle,
  noAllergenText,
}: ProductDetailProps) {
  const visibleDetails = details.filter(
    (detail) => detail.value.trim().length > 0
  );

  return (
    <div className="border-t border-[#6e1f12]/10 bg-[#fbf8f2] px-5 py-5 md:px-7 md:py-7">
      <div
        className={
          imageUrl
            ? "grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]"
            : "grid grid-cols-1"
        }
      >
        {imageUrl && (
          <img
            src={imageUrl}
            alt={name}
            loading="lazy"
            className="aspect-square w-full rounded-2xl border border-[#6e1f12]/10 object-cover md:w-[220px]"
          />
        )}

        <div className="min-w-0">
          {description && (
            <p className="text-sm leading-7 text-[#292821]/70 md:text-base">
              {description}
            </p>
          )}

          {visibleDetails.length > 0 && (
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {visibleDetails.map((detail) => (
                <DetailRow
                  key={`${detail.label}-${detail.value}`}
                  label={detail.label}
                  value={detail.value}
                />
              ))}
            </div>
          )}

          <div className="mt-5">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-[#6e1f12]/55">
              {allergensTitle}
            </p>

            {allergens.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {allergens.map((allergen) => (
                  <Badge key={allergen}>{allergen}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#292821]/45">
                {noAllergenText}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-[#6e1f12]/10 bg-white px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#6e1f12]/45">
        {label}
      </p>

      <p
        className="mt-1 text-sm font-bold text-[#6e1f12]"
        style={{ fontFamily: BRAND_FONT }}
      >
        {value}
      </p>
    </div>
  );
}