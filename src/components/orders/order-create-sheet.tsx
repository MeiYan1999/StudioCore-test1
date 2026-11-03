"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createOrderAction } from "@/lib/actions/order-actions";
import { initialActionState } from "@/lib/actions/action-state";
import type { CatalogOptions } from "@/lib/services/catalog-service";
import type { AssigneeOption } from "@/lib/services/order-service";
import { calculateOrderTotals, type VoucherRule } from "@/lib/orders/totals";
import { formatVnd } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SubmitButton } from "@/components/shared/submit-button";

type CustomerOption = {
  id: string;
  name: string;
  phone: string;
  branchId: string;
};

type BranchOption = { id: string; name: string };

type OrderItemDraft = {
  key: string;
  itemType: "service" | "addon" | "product" | "custom";
  refId: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
};

function makeKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function firstItemsForBranch(
  catalog: CatalogOptions,
  branchId: string,
): OrderItemDraft[] {
  const service = catalog.services.find(
    (item) => item.active && item.branchId === branchId,
  );
  if (!service) {
    return [];
  }

  return [
    {
      key: makeKey(),
      itemType: "service",
      refId: service.id,
      name: service.name,
      quantity: 1,
      unitPrice: service.price,
    },
  ];
}

function catalogKey(item: OrderItemDraft): string {
  return item.itemType === "custom" ? "custom" : `${item.itemType}:${item.refId}`;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-[var(--danger)]">{message}</p>;
}

export function OrderCreateSheet({
  branches,
  customers,
  catalog,
  assignees,
  defaultBranchId,
}: {
  branches: BranchOption[];
  customers: CustomerOption[];
  catalog: CatalogOptions;
  assignees: {
    photographers: AssigneeOption[];
    editors: AssigneeOption[];
    makeup: AssigneeOption[];
  };
  defaultBranchId: string;
}) {
  const [open, setOpen] = useState(false);
  const [branchId, setBranchId] = useState(defaultBranchId);
  const [customerMode, setCustomerMode] = useState<"existing" | "new">(
    customers.length > 0 ? "existing" : "new",
  );
  const [items, setItems] = useState<OrderItemDraft[]>(() =>
    firstItemsForBranch(catalog, defaultBranchId),
  );
  const [voucherCode, setVoucherCode] = useState("");
  const [surcharge, setSurcharge] = useState("");
  const [discount, setDiscount] = useState("");
  const [state, formAction] = useActionState(createOrderAction, initialActionState);

  const branchServices = catalog.services.filter(
    (item) => item.active && item.branchId === branchId,
  );
  const branchAddons = catalog.addons.filter(
    (item) => item.active && item.branchId === branchId,
  );
  const branchVouchers = catalog.vouchers.filter(
    (item) => item.active && (item.branchId === null || item.branchId === branchId),
  );
  const selectedVoucher = branchVouchers.find((item) => item.code === voucherCode);
  const voucherRule: VoucherRule | null = selectedVoucher
    ? {
        discountType: selectedVoucher.discountType,
        value: selectedVoucher.value,
        minOrder: selectedVoucher.minOrder,
        maxDiscount: selectedVoucher.maxDiscount,
      }
    : null;
  const totals = calculateOrderTotals({
    items,
    surcharge: Number(surcharge) || 0,
    discount: Number(discount) || 0,
    voucher: voucherRule,
  });

  const customerOptions = customers;
  const defaultCustomerId = customers[0]?.id ?? "";
  const photographerOptions = assignees.photographers.filter((member) =>
    member.branchIds.includes(branchId),
  );
  const editorOptions = assignees.editors.filter((member) =>
    member.branchIds.includes(branchId),
  );
  const makeupOptions = assignees.makeup.filter((member) =>
    member.branchIds.includes(branchId),
  );

  function updateBranch(nextBranchId: string) {
    setBranchId(nextBranchId);
    setItems(firstItemsForBranch(catalog, nextBranchId));
    setVoucherCode("");
  }

  function updateItem(index: number, patch: Partial<OrderItemDraft>) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  }

  function changeCatalog(index: number, value: string) {
    if (value === "custom") {
      updateItem(index, {
        itemType: "custom",
        refId: null,
        name: "",
        unitPrice: 0,
      });
      return;
    }

    const [type, id] = value.split(":") as [OrderItemDraft["itemType"], string];
    if (type === "service") {
      const service = branchServices.find((item) => item.id === id);
      if (service) {
        updateItem(index, {
          itemType: "service",
          refId: service.id,
          name: service.name,
          unitPrice: service.price,
        });
      }
    } else if (type === "addon") {
      const addon = branchAddons.find((item) => item.id === id);
      if (addon) {
        updateItem(index, {
          itemType: "addon",
          refId: addon.id,
          name: addon.name,
          unitPrice: addon.price,
        });
      }
    } else if (type === "product") {
      const product = catalog.products.find(
        (item) => item.id === id && item.status === "active",
      );
      if (product) {
        updateItem(index, {
          itemType: "product",
          refId: product.id,
          name: product.name,
          unitPrice: product.price,
        });
      }
    }
  }

  const itemsJson = JSON.stringify(
    items.map((item) => ({
      itemType: item.itemType,
      refId: item.refId,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Tạo đơn hàng
        </Button>
      </SheetTrigger>
      <SheetContent className="max-w-3xl">
        <SheetHeader>
          <SheetTitle>Tạo đơn hàng</SheetTitle>
          <SheetDescription>
            Giá dịch vụ, add-on và sản phẩm được lấy lại từ server khi lưu. Voucher và cọc được kiểm tra ở server.
          </SheetDescription>
        </SheetHeader>

        <form action={formAction} className="space-y-6" noValidate>
          {state.status === "error" && state.message ? (
            <Alert tone="danger">{state.message}</Alert>
          ) : null}

          <fieldset className="space-y-4">
            <legend className="text-base font-semibold text-foreground">Khách hàng & chi nhánh</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="order-branch">Chi nhánh</Label>
                <Select
                  id="order-branch"
                  name="branchId"
                  value={branchId}
                  onChange={(event) => updateBranch(event.target.value)}
                  className="mt-1.5"
                  required
                >
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </Select>
                <FieldError message={state.fieldErrors?.branchId} />
              </div>

              <div>
                <Label>Loại khách</Label>
                <div className="mt-2 flex gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="customerMode"
                      value="existing"
                      checked={customerMode === "existing"}
                      onChange={() => setCustomerMode("existing")}
                      className="h-4 w-4"
                    />
                    Khách có sẵn
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="customerMode"
                      value="new"
                      checked={customerMode === "new"}
                      onChange={() => setCustomerMode("new")}
                      className="h-4 w-4"
                    />
                    Khách mới
                  </label>
                </div>
              </div>

              {customerMode === "existing" ? (
                <div className="sm:col-span-2">
                  <Label htmlFor="order-customer">Chọn khách hàng</Label>
                  <Select
                    id="order-customer"
                    name="customerId"
                    defaultValue={defaultCustomerId}
                    className="mt-1.5"
                  >
                    <option value="">Chọn khách hàng</option>
                    {customerOptions.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} · {customer.phone}
                      </option>
                    ))}
                  </Select>
                  <FieldError message={state.fieldErrors?.customerId} />
                </div>
              ) : (
                <>
                  <div>
                    <Label htmlFor="order-customer-name">Tên khách mới</Label>
                    <Input id="order-customer-name" name="customerName" className="mt-1.5" />
                  </div>
                  <div>
                    <Label htmlFor="order-customer-phone">Số điện thoại</Label>
                    <Input
                      id="order-customer-phone"
                      name="customerPhone"
                      inputMode="tel"
                      className="mt-1.5"
                    />
                  </div>
                </>
              )}
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-base font-semibold text-foreground">Lịch & phân công</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="order-scheduled">Lịch chụp</Label>
                <Input
                  id="order-scheduled"
                  name="scheduledAt"
                  type="datetime-local"
                  className="mt-1.5"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Kiểm tra xung đột lịch sẽ được bật ở Phase 3.
                </p>
              </div>
              <div>
                <Label htmlFor="order-location">Địa điểm</Label>
                <Input id="order-location" name="location" className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="order-photographer">Photographer</Label>
                <Select id="order-photographer" name="photographerId" className="mt-1.5">
                  <option value="">Chưa phân công</option>
                  {photographerOptions.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="order-editor">Retoucher / Editor</Label>
                <Select id="order-editor" name="editorId" className="mt-1.5">
                  <option value="">Chưa phân công</option>
                  {editorOptions.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="order-makeup">Makeup</Label>
                <Select id="order-makeup" name="makeupId" className="mt-1.5">
                  <option value="">Chưa phân công</option>
                  {makeupOptions.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <legend className="text-base font-semibold text-foreground">Dịch vụ & sản phẩm</legend>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setItems((current) => [
                    ...current,
                    {
                      key: makeKey(),
                      itemType: "custom",
                      refId: null,
                      name: "",
                      quantity: 1,
                      unitPrice: 0,
                    },
                  ])
                }
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Thêm item
              </Button>
            </div>

            <input type="hidden" name="itemsJson" value={itemsJson} />
            {items.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                Chưa có item. Thêm dịch vụ, sản phẩm hoặc item tự nhập.
              </p>
            ) : null}
            <div className="space-y-3">
              {items.map((item, index) => (
                <div
                  key={item.key}
                  className="rounded-lg border border-border bg-surface p-3"
                >
                  <div className="grid gap-3 sm:grid-cols-[1.5fr_0.6fr_0.7fr_0.7fr_auto] sm:items-end">
                    <div>
                      <Label htmlFor={`item-catalog-${index}`} className="text-xs">
                        Item
                      </Label>
                      <Select
                        id={`item-catalog-${index}`}
                        value={catalogKey(item)}
                        onChange={(event) => changeCatalog(index, event.target.value)}
                        className="mt-1 h-9 text-xs"
                      >
                        <option value="">Chọn item</option>
                        <optgroup label="Dịch vụ">
                          {branchServices.map((service) => (
                            <option key={service.id} value={`service:${service.id}`}>
                              {service.name} · {formatVnd(service.price)}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Add-on">
                          {branchAddons.map((addon) => (
                            <option key={addon.id} value={`addon:${addon.id}`}>
                              {addon.name} · {formatVnd(addon.price)}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Sản phẩm">
                          {catalog.products
                            .filter((product) => product.status === "active")
                            .map((product) => (
                              <option key={product.id} value={`product:${product.id}`}>
                                {product.name} · {formatVnd(product.price)}
                              </option>
                            ))}
                        </optgroup>
                        <option value="custom">Item tự nhập</option>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor={`item-quantity-${index}`} className="text-xs">
                        SL
                      </Label>
                      <Input
                        id={`item-quantity-${index}`}
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(event) =>
                          updateItem(index, {
                            quantity: Math.max(1, Number(event.target.value) || 1),
                          })
                        }
                        className="mt-1 h-9"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      {item.itemType === "custom" ? (
                        <>
                          <Label htmlFor={`item-name-${index}`} className="text-xs">
                            Tên item
                          </Label>
                          <Input
                            id={`item-name-${index}`}
                            value={item.name}
                            onChange={(event) => updateItem(index, { name: event.target.value })}
                            className="mt-1 h-9"
                            placeholder="Mô tả item"
                          />
                        </>
                      ) : (
                        <>
                          <span className="block text-xs text-muted-foreground">Tên / đơn giá</span>
                          <p className="mt-1 truncate text-sm text-foreground">
                            {item.name} · {formatVnd(item.unitPrice)}
                          </p>
                        </>
                      )}
                    </div>
                    <div>
                      {item.itemType === "custom" ? (
                        <>
                          <Label htmlFor={`item-price-${index}`} className="text-xs">
                            Đơn giá
                          </Label>
                          <Input
                            id={`item-price-${index}`}
                            type="number"
                            min={0}
                            value={item.unitPrice}
                            onChange={(event) =>
                              updateItem(index, {
                                unitPrice: Math.max(0, Number(event.target.value) || 0),
                              })
                            }
                            className="mt-1 h-9"
                          />
                        </>
                      ) : (
                        <span className="block text-right text-sm font-medium tabular-nums text-foreground">
                          {formatVnd(item.quantity * item.unitPrice)}
                        </span>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Xóa item ${index + 1}`}
                      onClick={() =>
                        setItems((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                      className="text-muted-foreground"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <FieldError message={state.fieldErrors?.items} />
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-base font-semibold text-foreground">Thanh toán</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="order-surcharge">Phụ thu (VND)</Label>
                <Input
                  id="order-surcharge"
                  name="surcharge"
                  type="number"
                  min={0}
                  step={1}
                  value={surcharge}
                  onChange={(event) => setSurcharge(event.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="order-discount">Giảm giá thủ công (VND)</Label>
                <Input
                  id="order-discount"
                  name="discount"
                  type="number"
                  min={0}
                  step={1}
                  value={discount}
                  onChange={(event) => setDiscount(event.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="order-voucher">Voucher</Label>
                <Select
                  id="order-voucher"
                  name="voucherCode"
                  value={voucherCode}
                  onChange={(event) => setVoucherCode(event.target.value)}
                  className="mt-1.5"
                >
                  <option value="">Không dùng voucher</option>
                  {branchVouchers.map((voucher) => (
                    <option key={voucher.id} value={voucher.code}>
                      {voucher.code} · {voucher.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="order-deposit">Tiền cọc (VND)</Label>
                <Input
                  id="order-deposit"
                  name="deposit"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={0}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="order-deposit-method">Phương thức cọc</Label>
                <Select
                  id="order-deposit-method"
                  name="depositMethod"
                  defaultValue="cash"
                  className="mt-1.5"
                >
                  <option value="cash">Tiền mặt</option>
                  <option value="bank_transfer">Chuyển khoản</option>
                  <option value="card">Thẻ</option>
                  <option value="ewallet">Ví điện tử</option>
                </Select>
              </div>
              <div className="rounded-lg bg-surface-muted p-3 text-sm sm:col-span-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tạm tính</span>
                  <span className="tabular-nums">{formatVnd(totals.subtotal)}</span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span className="text-muted-foreground">Voucher</span>
                  <span className="tabular-nums">−{formatVnd(totals.voucherDiscount)}</span>
                </div>
                <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-semibold">
                  <span>Tổng dự kiến</span>
                  <span className="tabular-nums">{formatVnd(totals.total)}</span>
                </div>
              </div>
            </div>
          </fieldset>

          <div>
            <Label htmlFor="order-notes">Ghi chú</Label>
            <textarea
              id="order-notes"
              name="notes"
              rows={2}
              className="mt-1.5 w-full rounded-lg border border-[var(--input-border)] bg-surface px-3 py-2 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
            />
          </div>

          <SheetFooter>
            <SheetClose asChild>
              <Button type="button" variant="ghost">
                Hủy
              </Button>
            </SheetClose>
            <SubmitButton pendingLabel="Đang tạo đơn...">Tạo đơn hàng</SubmitButton>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
