import { SolutionTemplate } from "@/components/marketing/solution-template";
import { SOLUTION_PAGES } from "@/lib/marketing/content";
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "CRM studio chụp ảnh — StudioCore",
  description: SOLUTION_PAGES.crm.description,
  path: SOLUTION_PAGES.crm.path,
});

export default function CrmSolutionPage() {
  const data = SOLUTION_PAGES.crm;
  return <SolutionTemplate data={data} />;
}
