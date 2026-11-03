import {
  Banknote,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckSquare2,
  Cloud,
  Clock,
  FileText,
  Images,
  Layers,
  MessageSquare,
  Package,
  ReceiptText,
  Rocket,
  Scale,
  Shirt,
  Sparkles,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  banknote: Banknote,
  chart: BarChart3,
  briefcase: BriefcaseBusiness,
  building: Building2,
  calendar: CalendarDays,
  check: CheckSquare2,
  cloud: Cloud,
  clock: Clock,
  file: FileText,
  images: Images,
  layers: Layers,
  message: MessageSquare,
  package: Package,
  receipt: ReceiptText,
  rocket: Rocket,
  scale: Scale,
  shirt: Shirt,
  sparkles: Sparkles,
  users: Users,
  wallet: Wallet,
};

export function MarketingIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = ICONS[name] ?? Sparkles;
  return <Icon className={className} aria-hidden />;
}
