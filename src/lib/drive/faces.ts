import { DRIVE_FACE_DIM } from "./constants";
import { ValidationError } from "../errors";

export function parseDriveFaceDescriptor(raw: unknown): number[] {
  if (!Array.isArray(raw) || raw.length !== DRIVE_FACE_DIM) {
    throw new ValidationError(`Mỗi mã khuôn mặt phải có đúng ${DRIVE_FACE_DIM} giá trị.`);
  }
  const descriptor: number[] = [];
  for (const value of raw) {
    if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > 2) {
      throw new ValidationError("Mã khuôn mặt chứa giá trị không hợp lệ.");
    }
    descriptor.push(value);
  }
  return descriptor;
}

export function roundDriveFaceDescriptor(descriptor: number[]): number[] {
  return descriptor.map((value) => Math.round(value * 10_000) / 10_000);
}

export function driveFaceDistance(a: number[], b: number[]): number {
  let squaredDistance = 0;
  for (let i = 0; i < DRIVE_FACE_DIM; i += 1) {
    const delta = a[i] - b[i];
    squaredDistance += delta * delta;
  }
  return Math.sqrt(squaredDistance);
}
