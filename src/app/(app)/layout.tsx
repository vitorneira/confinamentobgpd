import { TopNav } from "@/components/nav/TopNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <TopNav />
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
