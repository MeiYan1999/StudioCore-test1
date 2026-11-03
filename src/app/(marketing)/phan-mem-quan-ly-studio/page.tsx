import { SolutionTemplate } from "@/components/marketing/solution-template";
import { SOLUTION_PAGES } from "@/lib/marketing/content";
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "Phần mềm quản lý studio chụp ảnh — StudioCore",
  description: SOLUTION_PAGES.studio.description,
  path: SOLUTION_PAGES.studio.path,
});

export default function StudioSolutionPage() {
  const data = SOLUTION_PAGES.studio;
  return <SolutionTemplate data={data} />;
}
