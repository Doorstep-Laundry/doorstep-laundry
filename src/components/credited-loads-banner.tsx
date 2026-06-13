"use client";

type Props = { creditedLoads: number };

export function CreditedLoadsBanner({ creditedLoads }: Props) {
  if (creditedLoads <= 0) return null;
  const loadWord = creditedLoads === 1 ? "load" : "loads";
  return (
    <div className="w-full bg-green-500 text-white px-4 py-3 text-center text-sm font-semibold shadow-sm">
      🎉 You have {creditedLoads} free {loadWord} remaining! Your next {loadWord} will be washed at no charge.
    </div>
  );
}
