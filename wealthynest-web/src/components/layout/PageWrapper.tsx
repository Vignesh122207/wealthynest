import {cn} from "@/lib/utils";

interface PageWrapperProps {
  children:   React.ReactNode;
  className?: string;
}

export function PageWrapper({ children, className }: PageWrapperProps) {
  return (
    <main className={cn("flex-1 p-4 md:p-5 lg:p-6 overflow-auto pb-36 lg:pb-24", className)}>
      <div className="max-w-7xl mx-auto space-y-4 lg:space-y-5">
        {children}
      </div>
    </main>
  );
}
