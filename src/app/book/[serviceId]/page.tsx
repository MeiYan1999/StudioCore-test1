import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb, facebookPages } from "@/lib/db/client";
import { getOffer } from "@/lib/omnichannel/booking";
import { BookingForm } from "@/components/omnichannel/booking-form";
import "@/components/omnichannel/workspace.css";
const money = (value: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);
export const dynamic = "force-dynamic";
export default async function PublicPackage({
  params,
  searchParams,
}: {
  params: Promise<{ serviceId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { serviceId } = await params;
  const { token } = await searchParams;
  const db = getDb();
  let data;
  try {
    data = getOffer(db, serviceId);
  } catch {
    notFound();
  }
  const page = db
    .select({ id: facebookPages.id })
    .from(facebookPages)
    .where(
      and(
        eq(facebookPages.tenantId, data.offer.tenantId),
        eq(facebookPages.branchId, data.service.branchId),
        eq(facebookPages.status, "connected"),
      ),
    )
    .get();
  return (
    <main className="omni omni-public">
      {data.service.image && (
        <img src={data.service.image} alt={data.service.name} />
      )}
      <h1>{data.service.name}</h1>
      <p>{data.service.description}</p>
      <p>
        {money(data.service.price)} · {data.service.durationMinutes} phút
      </p>
      <p>
        Cọc yêu cầu {money(data.offer.deposit)} · Giữ chỗ{" "}
        {data.offer.holdMinutes} phút
      </p>
      {page && (
        <a href={`https://m.me/${page.id}`} target="_blank" rel="noreferrer">
          Nhắn Fanpage
        </a>
      )}
      <h2>Đặt lịch chụp</h2>
      <BookingForm packages={[data.service]} token={token} />
    </main>
  );
}
