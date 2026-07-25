type Props = {
  value: number | null;
};

export default function Price({ value }: Props) {
  if (value == null) return null;

  return (
    <span
      className="text-lg font-bold text-[#6e1f12]"
      style={{
        fontFamily:
          '"American Typewriter","Courier New",monospace',
      }}
    >
      {Number(value).toLocaleString("tr-TR")} ₺
    </span>
  );
}