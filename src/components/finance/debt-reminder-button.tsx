"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { BellRing } from "lucide-react";
import { toast } from "sonner";
import { SubmitButton } from "@/components/shared/submit-button";
import { initialActionState } from "@/lib/actions/action-state";
import { remindDebtAction } from "@/lib/actions/finance-actions";

export function DebtReminderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [, formAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result = await remindDebtAction(previousState, formData);
      if (result.status === "success") {
        toast.success(result.message ?? "Đã ghi nhắc thu.");
        router.refresh();
      } else if (result.status === "error") {
        toast.error(result.message ?? "Không ghi được nhắc thu.");
      }
      return result;
    },
    initialActionState,
  );
  return (
    <form action={formAction}>
      <input type="hidden" name="orderId" value={orderId} />
      <SubmitButton variant="ghost" size="sm" pendingLabel="...">
        <BellRing className="h-3.5 w-3.5" aria-hidden />
        Nhắc thu
      </SubmitButton>
    </form>
  );
}
