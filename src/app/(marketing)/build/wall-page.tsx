import type { ReactNode } from "react";
import { WallHeader } from "./wall-header";

type Width = "narrow" | "regular" | "wide";

const COLUMN_CLASS: Record<Width, string> = {
  narrow: "mx-auto max-w-[560px] px-6 pb-24 pt-16 sm:pt-24",
  regular: "mx-auto max-w-[1120px] px-6 pb-24 pt-4 sm:px-12",
  wide: "mx-auto max-w-[1280px] px-6 pb-24 pt-4 sm:px-12",
};

/** One Role Builder screen on the wall: the baize, the header, one measured column. */
export function WallPage({
  email,
  width = "regular",
  children,
}: {
  email?: string | null;
  width?: Width;
  children: ReactNode;
}) {
  return (
    <div className="wall" style={{ minHeight: "100vh" }}>
      <WallHeader email={email} />
      <div className={COLUMN_CLASS[width]}>{children}</div>
    </div>
  );
}
