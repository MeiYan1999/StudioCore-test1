"use client";

import { useActionState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addCustomerInteractionAction } from "@/lib/actions/customer-actions";
import { initialActionState } from "@/lib/actions/action-state";
import { INTERACTION_TYPES } from "@/lib/crm/constants";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/shared/submit-button";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) {
    return null;
  }
  return (
    <p id={id} className="mt-1 text-xs text-[var(--danger)]">
      {message}
    </p>
  );
}

export function CustomerInteractionForm({ customerId }: { customerId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result = await addCustomerInteractionAction(previousState, formData);
      if (result.status === "success") {
        toast.success(result.message ?? "Đã ghi nhận tương tác.");
        formRef.current?.reset();
        router.refresh();
      }
      return result;
    },
    initialActionState,
  );

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-4 rounded-xl border border-border bg-surface-muted/50 p-4"
      noValidate
    >
      <input type="hidden" name="customerId" value={customerId} />
      {state.status === "error" && state.message ? (
        <Alert tone="danger">{state.message}</Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="interaction-type">Loại tương tác</Label>
          <Select
            id="interaction-type"
            name="type"
            defaultValue={state.values?.type ?? "call"}
            className="mt-1.5"
          >
            {INTERACTION_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="interaction-occurred">Thời điểm</Label>
          <Input
            id="interaction-occurred"
            name="occurredAt"
            type="datetime-local"
            defaultValue={state.values?.occurredAt ?? ""}
            className="mt-1.5"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Để trống để dùng thời điểm hiện tại.
          </p>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="interaction-content">Nội dung</Label>
          <textarea
            id="interaction-content"
            name="content"
            rows={3}
            defaultValue={state.values?.content ?? ""}
            className="mt-1.5 w-full rounded-lg border border-[var(--input-border)] bg-surface px-3 py-2 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
            required
          />
          <FieldError
            id="interaction-content-error"
            message={state.fieldErrors?.content}
          />
        </div>
        <div>
          <Label htmlFor="interaction-follow-up">Follow-up tiếp theo</Label>
          <Input
            id="interaction-follow-up"
            name="followUpAt"
            type="datetime-local"
            defaultValue={state.values?.followUpAt ?? ""}
            className="mt-1.5"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <SubmitButton pendingLabel="Đang lưu...">Ghi nhận tương tác</SubmitButton>
      </div>
    </form>
  );
}
