import type { ActorContext } from "@/lib/auth/types";
import type { AppDb } from "@/lib/db/client";
import { AuthorizationError, NotFoundError } from "@/lib/errors";
import { getAlbumDetail } from "@/lib/services/album-service";
import { getAppointmentDetail } from "@/lib/services/appointment-service";
import { getCustomerDetail } from "@/lib/services/customer-service";
import { getEquipmentDetail } from "@/lib/services/equipment-service";
import { getOrderDetail } from "@/lib/services/order-service";
import { getStaffDetail } from "@/lib/services/staff-service";
import { getWardrobeItemDetail } from "@/lib/services/wardrobe-service";

type DetailLookup = (db: AppDb, actor: ActorContext, id: string) => unknown;

const DETAIL_ROUTES: { pattern: RegExp; lookup: DetailLookup }[] = [
  { pattern: /^\/manage\/orders\/([^/]+)$/, lookup: getOrderDetail },
  { pattern: /^\/manage\/customers\/([^/]+)$/, lookup: getCustomerDetail },
  { pattern: /^\/manage\/albums\/([^/]+)(?:\/(?:filter|notes))?$/, lookup: getAlbumDetail },
  { pattern: /^\/manage\/equipment\/([^/]+)$/, lookup: getEquipmentDetail },
  // `rentals` is a static sibling route of wardrobe/[id].
  { pattern: /^\/manage\/wardrobe\/(?!rentals$)([^/]+)$/, lookup: getWardrobeItemDetail },
  { pattern: /^\/manage\/calendar\/([^/]+)$/, lookup: getAppointmentDetail },
  { pattern: /^\/manage\/settings\/users\/([^/]+)$/, lookup: getStaffDetail },
];

// Detail pages stream behind loading.tsx, so a notFound() there can only send 200.
// Checking the record before rendering lets the response carry a real 404.
// Permission failures are left to the page, which renders its forbidden state.
export function isMissingDetailRecord(
  db: AppDb,
  actor: ActorContext,
  pathname: string,
): boolean {
  for (const { pattern, lookup } of DETAIL_ROUTES) {
    const match = pattern.exec(pathname);
    if (!match) continue;
    let id: string;
    try {
      id = decodeURIComponent(match[1]);
    } catch {
      return true;
    }
    try {
      return lookup(db, actor, id) == null;
    } catch (error) {
      if (error instanceof NotFoundError) return true;
      if (error instanceof AuthorizationError) return false;
      throw error;
    }
  }
  return false;
}
