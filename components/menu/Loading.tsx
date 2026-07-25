export default function Loading() {
  return (
    <div className="flex min-h-[300px] items-center justify-center">

      <div className="text-center">

        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[#6e1f12]/20 border-t-[#6e1f12]" />

        <p className="text-[#6e1f12]">
          Menü yükleniyor...
        </p>

      </div>

    </div>
  );
}