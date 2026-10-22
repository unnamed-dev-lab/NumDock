import { ApiError } from "@/lib/api/client";
export const retryRead = (count: number, error: Error) =>
  !(error instanceof ApiError && error.status < 500) && count < 1;
