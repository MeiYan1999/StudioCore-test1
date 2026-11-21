import { randomUUID } from "node:crypto";

/**
 * Cầu nối trong bộ nhớ giữa khách xem link và ứng dụng StudioCore Drive trên máy studio.
 * Máy studio giữ một kết nối long-poll để nhận yêu cầu, rồi đẩy dữ liệu tệp ngược lên;
 * máy chủ chuyển tiếp thẳng cho khách mà không lưu ảnh gốc.
 */

export type DriveVariant = "thumb" | "preview" | "original";

export type DriveRelayJob = {
  id: string;
  shareId: string;
  fileKey: string;
  variant: DriveVariant;
  range: string | null;
};

export type DriveRelayResult = {
  status: number;
  contentType: string;
  contentLength: string | null;
  contentRange: string | null;
  body: ReadableStream<Uint8Array> | null;
};

type Pending = {
  job: DriveRelayJob;
  deviceId: string;
  taken: boolean;
  resolve: (result: DriveRelayResult) => void;
  timer: ReturnType<typeof setTimeout>;
};

type Broker = {
  pending: Map<string, Pending>;
  queues: Map<string, string[]>;
  waiters: Map<string, Set<() => void>>;
  thumbs: Map<string, { type: string; data: Uint8Array }>;
  thumbBytes: number;
};

const JOB_TIMEOUT_MS = 30_000;
const MAX_PENDING_PER_DEVICE = 400;
const THUMB_CACHE_BYTES = 96 * 1024 * 1024;
const THUMB_MAX_ITEM = 512 * 1024;

const globalBroker = globalThis as typeof globalThis & { __studiocoreDriveRelay?: Broker };

function broker(): Broker {
  globalBroker.__studiocoreDriveRelay ??= {
    pending: new Map(),
    queues: new Map(),
    waiters: new Map(),
    thumbs: new Map(),
    thumbBytes: 0,
  };
  return globalBroker.__studiocoreDriveRelay;
}

const UNAVAILABLE: DriveRelayResult = {
  status: 504,
  contentType: "text/plain; charset=utf-8",
  contentLength: null,
  contentRange: null,
  body: null,
};

export function requestDriveFile(
  deviceId: string,
  input: Omit<DriveRelayJob, "id">,
  timeoutMs: number = JOB_TIMEOUT_MS,
): Promise<DriveRelayResult> {
  const b = broker();
  const queue = b.queues.get(deviceId) ?? [];
  if (queue.length >= MAX_PENDING_PER_DEVICE) {
    return Promise.resolve({ ...UNAVAILABLE, status: 503 });
  }
  const id = randomUUID();
  return new Promise<DriveRelayResult>((resolve) => {
    const timer = setTimeout(() => {
      settle(id, UNAVAILABLE);
    }, timeoutMs);
    b.pending.set(id, { job: { id, ...input }, deviceId, taken: false, resolve, timer });
    queue.push(id);
    b.queues.set(deviceId, queue);
    for (const wake of [...(b.waiters.get(deviceId) ?? [])]) wake();
  });
}

function settle(id: string, result: DriveRelayResult): boolean {
  const b = broker();
  const pending = b.pending.get(id);
  if (!pending) return false;
  clearTimeout(pending.timer);
  b.pending.delete(id);
  const queue = b.queues.get(pending.deviceId);
  if (queue) {
    const index = queue.indexOf(id);
    if (index >= 0) queue.splice(index, 1);
    if (queue.length === 0) b.queues.delete(pending.deviceId);
  }
  pending.resolve(result);
  return true;
}

function takeJobs(deviceId: string, max: number): DriveRelayJob[] {
  const b = broker();
  const jobs: DriveRelayJob[] = [];
  for (const id of b.queues.get(deviceId) ?? []) {
    const pending = b.pending.get(id);
    if (pending && !pending.taken) {
      pending.taken = true;
      jobs.push(pending.job);
      if (jobs.length >= max) break;
    }
  }
  return jobs;
}

/** Máy studio chờ việc: trả về ngay khi có yêu cầu, hoặc mảng rỗng sau `waitMs`. */
export function pollDriveJobs(
  deviceId: string,
  waitMs: number,
  signal?: AbortSignal,
  max = 8,
): Promise<DriveRelayJob[]> {
  const ready = takeJobs(deviceId, max);
  if (ready.length > 0 || waitMs <= 0) return Promise.resolve(ready);
  const b = broker();
  return new Promise((resolve) => {
    const waiters = b.waiters.get(deviceId) ?? new Set<() => void>();
    b.waiters.set(deviceId, waiters);
    const finish = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", finish);
      waiters.delete(finish);
      if (waiters.size === 0) b.waiters.delete(deviceId);
      resolve(takeJobs(deviceId, max));
    };
    const timer = setTimeout(finish, waitMs);
    signal?.addEventListener("abort", finish, { once: true });
    waiters.add(finish);
  });
}

/** Đánh thức long-poll của một thiết bị (ví dụ khi khách vừa gửi lựa chọn). */
export function wakeDriveDevice(deviceId: string): void {
  for (const wake of [...(broker().waiters.get(deviceId) ?? [])]) wake();
}

/** Máy studio trả kết quả cho một yêu cầu. Chỉ đúng thiết bị được giao mới trả được. */
export function fulfillDriveJob(deviceId: string, jobId: string, result: DriveRelayResult): boolean {
  const pending = broker().pending.get(jobId);
  if (!pending || pending.deviceId !== deviceId) return false;
  return settle(jobId, result);
}

export function getCachedDriveThumb(shareId: string, fileKey: string) {
  const b = broker();
  const key = `${shareId}:${fileKey}`;
  const hit = b.thumbs.get(key);
  if (hit) {
    b.thumbs.delete(key);
    b.thumbs.set(key, hit);
  }
  return hit ?? null;
}

export function cacheDriveThumb(shareId: string, fileKey: string, type: string, data: Uint8Array): void {
  if (data.byteLength === 0 || data.byteLength > THUMB_MAX_ITEM) return;
  const b = broker();
  const key = `${shareId}:${fileKey}`;
  const old = b.thumbs.get(key);
  if (old) {
    b.thumbBytes -= old.data.byteLength;
    b.thumbs.delete(key);
  }
  b.thumbs.set(key, { type, data });
  b.thumbBytes += data.byteLength;
  for (const [k, v] of b.thumbs) {
    if (b.thumbBytes <= THUMB_CACHE_BYTES) break;
    b.thumbs.delete(k);
    b.thumbBytes -= v.data.byteLength;
  }
}

export function dropCachedDriveThumbs(shareId: string): void {
  const b = broker();
  for (const [k, v] of b.thumbs) {
    if (k.startsWith(`${shareId}:`)) {
      b.thumbs.delete(k);
      b.thumbBytes -= v.data.byteLength;
    }
  }
}

export function resetDriveRelayForTests(): void {
  delete globalBroker.__studiocoreDriveRelay;
}
