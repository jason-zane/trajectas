import { ForceLightTheme } from "@/components/force-light-theme";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ForceLightTheme />
      {children}
    </>
  );
}
