import { type ApiErrorBody, makeRequest, RivtApiError } from "../../lib/api";

export interface WorkReviewProfile {
  accountId: string;
  displayName: string;
  headline: string;
  serviceArea: { city: string; region: string };
}

export interface WorkReview {
  id: string;
  activeWorkId: string;
  projectId: string;
  jobId: string;
  reviewerAccountId: string;
  revieweeAccountId: string;
  reviewerRole: "contractor" | "tradesperson";
  rating: number;
  body: string;
  status: "pending_approval" | "approved" | "disputed" | "resolved" | "hidden";
  submittedAt: string;
  approvedAt: string | null;
  disputedAt: string | null;
  job?: {
    id: string;
    title: string;
    publicLocation: { city: string; region: string };
  };
  reviewer?: WorkReviewProfile;
  reviewee?: WorkReviewProfile;
}

class ReviewsApiError extends RivtApiError {
  constructor(status: number, body: ApiErrorBody) {
    super(status, body, "The review could not be updated.");
    this.name = "ReviewsApiError";
  }
}

const request = makeRequest((status, body) => new ReviewsApiError(status, body));

function requestKey() {
  return crypto.randomUUID();
}

export async function fetchWorkReviews() {
  const body = await request<{ data: { reviews: WorkReview[] } }>("/api/v1/reviews");
  return body.data.reviews;
}

export async function fetchWorkReview(reviewId: string) {
  const body = await request<{ data: { review: WorkReview } }>(`/api/v1/reviews/${reviewId}`);
  return body.data.review;
}

export async function approveWorkReview(reviewId: string) {
  const body = await request<{ data: { review: WorkReview } }>(`/api/v1/reviews/${reviewId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey() },
    body: JSON.stringify({}),
  });
  return body.data.review;
}

export async function disputeWorkReview(reviewId: string, reason: string) {
  const body = await request<{ data: { review: WorkReview } }>(`/api/v1/reviews/${reviewId}/dispute`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey() },
    body: JSON.stringify({ reason }),
  });
  return body.data.review;
}

export function reviewErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "The review could not be updated.";
}
