import { useCallback, useEffect, useMemo, useState } from "react";
import { apiPath } from "../../lib/api";
import { idempotencyKey } from "../../lib/app-helpers";
import type { CommunityReactionTargetType } from "./community-utils";
import {
  communityAnswerReactionKey,
  communityPostReactionKey,
  communityReactionLedgerKey,
} from "./community-utils";
import type {
  CommunityAnswer,
  CommunityPost,
  CommunityReaction,
  CommunityReactionState,
  CommunityReactionSummary,
} from "./ShopTalkView";

interface CommunityReactionAggregate {
  targetType: CommunityReactionTargetType;
  targetKey: string;
  upvotes: number;
  downvotes: number;
  score: number;
  viewerReaction: CommunityReaction | null;
}

type CommunityReactionLedger = Record<string, CommunityReactionAggregate>;
type CommunityReactionSyncStatus = "idle" | "loading" | "ready" | "error";

interface UseCommunityReactionsParams {
  authReady: boolean;
  communityPosts: CommunityPost[];
  onReactionError: (message: string) => void;
}

export function useCommunityReactions({
  authReady,
  communityPosts,
  onReactionError,
}: UseCommunityReactionsParams) {
  const [communityReactionLedger, setCommunityReactionLedger] = useState<CommunityReactionLedger>({});
  const [communityReactionSummary, setCommunityReactionSummary] = useState<CommunityReactionSummary | null>(null);
  const [communityReactionStatus, setCommunityReactionStatus] = useState<CommunityReactionSyncStatus>("idle");
  const [pendingCommunityReactions, setPendingCommunityReactions] = useState<Set<string>>(new Set());

  const communityReactionTargets = useMemo(() => {
    const targets: { targetType: CommunityReactionTargetType; targetKey: string }[] = [];
    communityPosts.forEach((post) => {
      targets.push({ targetType: "thread", targetKey: communityPostReactionKey(post.id) });
      post.replies.forEach((answer) => {
        targets.push({ targetType: "answer", targetKey: communityAnswerReactionKey(post.id, answer.id) });
      });
    });
    return targets;
  }, [communityPosts]);

  const communityReactionTargetsKey = useMemo(() => (
    communityReactionTargets.map((target) => communityReactionLedgerKey(target.targetType, target.targetKey)).join("|")
  ), [communityReactionTargets]);

  const getCommunityPostReactionState = useCallback((post: CommunityPost): CommunityReactionState => {
    const targetKey = communityPostReactionKey(post.id);
    const ledgerKey = communityReactionLedgerKey("thread", targetKey);
    const aggregate = communityReactionLedger[ledgerKey];
    return {
      upvotes: post.upvotes + (aggregate?.upvotes ?? 0),
      downvotes: post.downvotes + (aggregate?.downvotes ?? 0),
      reaction: aggregate?.viewerReaction ?? null,
      serverOwned: communityReactionStatus === "ready",
      pending: pendingCommunityReactions.has(ledgerKey),
    };
  }, [communityReactionLedger, communityReactionStatus, pendingCommunityReactions]);

  const getCommunityAnswerReactionState = useCallback((postId: number, answer: CommunityAnswer): CommunityReactionState => {
    const targetKey = communityAnswerReactionKey(postId, answer.id);
    const ledgerKey = communityReactionLedgerKey("answer", targetKey);
    const aggregate = communityReactionLedger[ledgerKey];
    return {
      upvotes: answer.upvotes + (aggregate?.upvotes ?? 0),
      downvotes: answer.downvotes + (aggregate?.downvotes ?? 0),
      reaction: aggregate?.viewerReaction ?? null,
      serverOwned: communityReactionStatus === "ready",
      pending: pendingCommunityReactions.has(ledgerKey),
    };
  }, [communityReactionLedger, communityReactionStatus, pendingCommunityReactions]);

  const mergeCommunityReactionAggregate = useCallback((reaction: CommunityReactionAggregate) => {
    setCommunityReactionLedger((current) => ({
      ...current,
      [communityReactionLedgerKey(reaction.targetType, reaction.targetKey)]: reaction,
    }));
  }, []);

  useEffect(() => {
    if (!authReady) {
      return;
    }

    let cancelled = false;
    async function loadCommunityReactionLedger() {
      setCommunityReactionStatus("loading");
      try {
        const response = await fetch(apiPath("/api/v1/shop-talk/reactions/batch"), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targets: communityReactionTargets }),
        });
        const body = await response.json().catch(() => ({})) as {
          data?: { reactions?: CommunityReactionAggregate[]; reputation?: CommunityReactionSummary };
          error?: { message?: string };
        };
        if (!response.ok) throw new Error(body.error?.message || "Shop Talk reactions could not be loaded.");
        if (cancelled) return;
        setCommunityReactionLedger(
          (body.data?.reactions ?? []).reduce<CommunityReactionLedger>((ledger, reaction) => {
            ledger[communityReactionLedgerKey(reaction.targetType, reaction.targetKey)] = reaction;
            return ledger;
          }, {}),
        );
        setCommunityReactionSummary(body.data?.reputation ?? null);
        setCommunityReactionStatus("ready");
      } catch {
        if (cancelled) return;
        setCommunityReactionLedger({});
        setCommunityReactionSummary(null);
        setCommunityReactionStatus("error");
      }
    }

    void loadCommunityReactionLedger();
    return () => {
      cancelled = true;
    };
  }, [authReady, communityReactionTargets, communityReactionTargetsKey]);

  const setCommunityReactionPending = useCallback((ledgerKey: string, pending: boolean) => {
    setPendingCommunityReactions((current) => {
      const next = new Set(current);
      if (pending) {
        next.add(ledgerKey);
      } else {
        next.delete(ledgerKey);
      }
      return next;
    });
  }, []);

  const commitCommunityReaction = useCallback(async (
    targetType: CommunityReactionTargetType,
    targetKey: string,
    direction: "up" | "down",
  ) => {
    const ledgerKey = communityReactionLedgerKey(targetType, targetKey);
    if (pendingCommunityReactions.has(ledgerKey)) return;
    const previousReaction = communityReactionLedger[ledgerKey]?.viewerReaction ?? null;
    const nextReaction = previousReaction === direction ? null : direction;
    setCommunityReactionPending(ledgerKey, true);
    try {
      const response = await fetch(apiPath("/api/v1/shop-talk/reactions"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey("shop-talk-reaction"),
        },
        body: JSON.stringify({ targetType, targetKey, reaction: nextReaction }),
      });
      const body = await response.json().catch(() => ({})) as {
        data?: { reaction?: CommunityReactionAggregate; reputation?: CommunityReactionSummary };
        error?: { message?: string };
      };
      if (!response.ok || !body.data?.reaction) {
        throw new Error(body.error?.message || "Shop Talk reaction could not be saved.");
      }
      mergeCommunityReactionAggregate(body.data.reaction);
      setCommunityReactionSummary(body.data.reputation ?? null);
      setCommunityReactionStatus("ready");
    } catch (error) {
      onReactionError(error instanceof Error ? error.message : "Shop Talk reaction could not be saved.");
    } finally {
      setCommunityReactionPending(ledgerKey, false);
    }
  }, [
    communityReactionLedger,
    mergeCommunityReactionAggregate,
    onReactionError,
    pendingCommunityReactions,
    setCommunityReactionPending,
  ]);

  const handleVoteCommunityPost = useCallback((postId: number, direction: "up" | "down") => {
    void commitCommunityReaction("thread", communityPostReactionKey(postId), direction);
  }, [commitCommunityReaction]);

  const handleVoteCommunityAnswer = useCallback((postId: number, answerId: number, direction: "up" | "down") => {
    void commitCommunityReaction("answer", communityAnswerReactionKey(postId, answerId), direction);
  }, [commitCommunityReaction]);

  const resetCommunityReactions = useCallback(() => {
    setCommunityReactionLedger({});
    setCommunityReactionSummary(null);
    setCommunityReactionStatus("idle");
    setPendingCommunityReactions(new Set());
  }, []);

  return {
    communityReactionStatus,
    communityReactionSummary,
    getCommunityAnswerReactionState,
    getCommunityPostReactionState,
    handleVoteCommunityAnswer,
    handleVoteCommunityPost,
    resetCommunityReactions,
  };
}
