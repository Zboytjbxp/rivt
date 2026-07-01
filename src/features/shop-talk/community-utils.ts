export type CommunityReactionTargetType = "thread" | "answer";

export interface CommunityScoreItem {
  upvotes: number;
  downvotes: number;
}

export interface CommunityVerifiedAnswer extends CommunityScoreItem {
  verifiedFix: boolean;
}

export interface CommunityBadgeAnswer extends CommunityVerifiedAnswer {
  author: string;
}

export interface CommunityBadgePost {
  replies: CommunityBadgeAnswer[];
}

export interface CommunityBadgeThresholds {
  firstAssistVerifiedFixes: number;
  mentorQualityAnswers: number;
  topHandQualityAnswers: number;
}

export const defaultCommunityBadgeThresholds: CommunityBadgeThresholds = {
  firstAssistVerifiedFixes: 1,
  mentorQualityAnswers: 10,
  topHandQualityAnswers: 25,
};

export function netScore(item: CommunityScoreItem) {
  return item.upvotes - item.downvotes;
}

export function sortedAnswers<T extends CommunityVerifiedAnswer>(answers: T[]) {
  return [...answers].sort((a, b) => {
    if (a.verifiedFix !== b.verifiedFix) return a.verifiedFix ? -1 : 1;
    return netScore(b) - netScore(a);
  });
}

export function communityReactionLedgerKey(targetType: CommunityReactionTargetType, targetKey: string) {
  return `${targetType}:${targetKey}`;
}

export function communityPostReactionKey(postId: string) {
  return `post:${postId}`;
}

export function communityAnswerReactionKey(postId: string, answerId: number) {
  return `answer:${postId}:${answerId}`;
}

export function relativeTime(value: string): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return value;

  const diffMs = Date.now() - timestamp;
  if (diffMs < 0) return "just now";
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `${diffD}d ago`;
  const diffM = Math.floor(diffD / 30);
  if (diffM < 12) return `${diffM}mo ago`;
  const diffY = Math.floor(diffD / 365);
  return `${diffY}y ago`;
}

export function communityBadgeLabels(
  posts: CommunityBadgePost[],
  personName: string,
  thresholds: CommunityBadgeThresholds = defaultCommunityBadgeThresholds,
) {
  const answers = posts.flatMap((post) => post.replies).filter((answer) => answer.author === personName);
  const verifiedFixes = answers.filter((answer) => answer.verifiedFix).length;
  const qualityAnswers = answers.filter((answer) => netScore(answer) >= 3).length;
  const badges: string[] = [];

  if (verifiedFixes >= thresholds.firstAssistVerifiedFixes) {
    badges.push("First Assist");
  }
  if (qualityAnswers >= thresholds.mentorQualityAnswers) {
    badges.push("Trade Mentor");
  }
  if (qualityAnswers >= thresholds.topHandQualityAnswers && verifiedFixes > 1) {
    badges.push("Top Hand");
  }

  return badges;
}
