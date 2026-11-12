import { redirect } from "next/navigation";

export const metadata = { title: "Cài đặt Tin nhắn" };

export default function MessagingSettingsRedirect() {
  redirect("/manage/settings/facebook");
}
