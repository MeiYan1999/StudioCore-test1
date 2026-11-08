"use client";

import { useActionState } from "react";
import { Loader2, Send } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initialActionState } from "@/lib/actions/action-state";
import { submitContactAction } from "@/lib/actions/marketing-actions";

export function ContactForm({ source = "contact" }: { source?: string }) {
  const [state, formAction, pending] = useActionState(
    submitContactAction,
    initialActionState,
  );
  const values = state.values;
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="source" value={source} />
      <div className="sr-only" aria-hidden="true">
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {state.status === "error" ? <Alert tone="danger">{state.message}</Alert> : null}
      {state.status === "success" ? <Alert tone="success">{state.message}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="contact-name">Tên của bạn</Label>
          <Input id="contact-name" name="name" defaultValue={values?.name ?? ""} required className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="contact-email">Email</Label>
          <Input id="contact-email" name="email" type="email" defaultValue={values?.email ?? ""} required className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="contact-phone">SĐT</Label>
          <Input id="contact-phone" name="phone" defaultValue={values?.phone ?? ""} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="contact-studio">Tên studio</Label>
          <Input id="contact-studio" name="studioName" defaultValue={values?.studioName ?? ""} className="mt-1.5" />
        </div>
      </div>
      <div>
        <Label htmlFor="contact-message">Bạn cần hỗ trợ gì?</Label>
        <Textarea
          id="contact-message"
          name="message"
          rows={5}
          defaultValue={values?.message ?? ""}
          required
          minLength={10}
          maxLength={3000}
          className="mt-1.5"
          placeholder="Ví dụ: Studio có 2 chi nhánh, cần tư vấn lịch chụp và PhotoShare."
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Thông tin của bạn được cam kết bảo mật. Chuyên viên tư vấn StudioCore sẽ liên hệ lại trong vòng 15 phút qua Zalo / Số điện thoại.
      </p>
      <Button type="submit" className="w-full sm:w-auto" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
        {pending ? "Đang gửi..." : "Gửi yêu cầu tư vấn"}
      </Button>
    </form>
  );
}
