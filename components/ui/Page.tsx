import { ReactNode } from "react";
import PageHeader from "./PageHeader";

/** Standard padded page shell with a header. */
export function Page({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto w-full">
      <PageHeader title={title} subtitle={subtitle} action={action} />
      {children}
    </div>
  );
}
