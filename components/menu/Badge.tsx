type Props = {
  children: React.ReactNode;
};

export default function Badge({ children }: Props) {
  return (
    <span className="rounded-full border border-[#6e1f12]/10 bg-white px-3 py-1 text-xs text-[#6e1f12]">
      {children}
    </span>
  );
}