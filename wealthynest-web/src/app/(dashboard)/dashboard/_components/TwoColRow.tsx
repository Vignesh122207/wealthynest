export function TwoColRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid lg:grid-cols-2 gap-4 items-stretch">
      {children}
    </div>
  );
}
