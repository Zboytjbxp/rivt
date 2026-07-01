export type CommunityReactionTargetType = "thread" | "answer";

/** Converts a server ISO timestamp into a short relative label ("5m ago", "2h ago"). */
export function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

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
