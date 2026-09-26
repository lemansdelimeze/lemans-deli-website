-- Trendyol geçmiş siparişleri senkron çalıştığı gün kapanmış görünmesin.
-- external_payload içindeki gerçek Trendyol paket güncelleme zamanını kullanır.
UPDATE public.pos_orders
SET closed_at = to_timestamp(
  COALESCE(
    NULLIF(external_payload->>'packageModificationDate', '')::bigint,
    NULLIF(external_payload->>'packageCreationDate', '')::bigint
  ) / 1000.0
)
WHERE source = 'trendyol'
  AND status = 'closed'
  AND external_payload IS NOT NULL
  AND COALESCE(
    NULLIF(external_payload->>'packageModificationDate', ''),
    NULLIF(external_payload->>'packageCreationDate', '')
  ) IS NOT NULL;
