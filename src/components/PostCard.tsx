import React, { useEffect, useRef, useState } from 'react';
import {
  Heart,
  Image as ImageIcon,
  MessageCircle,
  Send,
  Share2,
  Trash2,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { Post } from '../types/social';
import { useSocial } from '../context/SocialContext';
import { Avatar } from './Avatar';
import { formatCompactCount, formatRelativeTime } from '../utils/formatters';
import { MAX_COMMENT_LENGTH, validateWithServerOrFallback } from '../utils/validation';

interface PostCardProps {
  post: Post;
  isSlowConnection: boolean;
}

export function PostCard({ post, isSlowConnection }: PostCardProps) {
  const {
    currentUser,
    allUsers,
    likedPostIds,
    followingIds,
    commentsByPost,
    loadCommentsForPost,
    toggleLikePost,
    addComment,
    sharePost,
    deletePost,
    toggleFollowUser,
    openProfile,
    openHashtag,
    highlightedPostId,
    setHighlightedPostId,
  } = useSocial();

  const liveAuthor = allUsers.find((u) => u.uid === post.authorId);
  const authorName = liveAuthor?.displayName || post.authorName;
  const authorUsername = liveAuthor?.username || post.authorUsername;
  const authorPhotoURL = liveAuthor?.photoURL ?? post.authorPhotoURL;
  const cardRef = useRef<HTMLElement>(null);
  const isHighlighted = highlightedPostId === post.id;

  useEffect(() => {
    if (isHighlighted && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const timer = setTimeout(() => setHighlightedPostId(null), 2400);
      return () => clearTimeout(timer);
    }
  }, [isHighlighted, setHighlightedPostId]);

  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [sharedFeedback, setSharedFeedback] = useState(false);
  const [imageLoadedOverride, setImageLoadedOverride] = useState(false);
  const [imageError, setImageError] = useState(false);

  const isLiked = likedPostIds.has(post.id);
  const isOwner = currentUser?.uid === post.authorId;
  const isFollowing = followingIds.has(post.authorId);
  const comments = commentsByPost[post.id] || [];

  useEffect(() => {
    if (!showComments) return;
    const unsubscribe = loadCommentsForPost(post.id);
    return () => unsubscribe();
  }, [showComments, post.id, loadCommentsForPost]);

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCommentError(null);
    setCommentSubmitting(true);
    try {
      const check = await validateWithServerOrFallback({
        type: 'comment',
        content: commentText,
      });
      if (!check.valid || !check.sanitizedContent) {
        setCommentError(check.error || 'Comment cannot be empty.');
        return;
      }
      await addComment(post.id, check.sanitizedContent);
      setCommentText('');
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'Failed to post comment.');
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleShare = async () => {
    await sharePost(post.id);
    setSharedFeedback(true);
    setTimeout(() => setSharedFeedback(false), 2000);
  };

  const renderFormattedContent = (text: string) => {
    const parts = text.split(/(#[a-zA-Z0-9_]{2,30})/g);
    return parts.map((part, idx) => {
      if (part.startsWith('#') && part.length > 2) {
        const tag = part.slice(1).toLowerCase();
        return (
          <button
            key={`${idx}-${part}`}
            type="button"
            onClick={() => openHashtag(tag)}
            className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium cursor-pointer"
          >
            {part}
          </button>
        );
      }
      return <React.Fragment key={idx}>{part}</React.Fragment>;
    });
  };

  const shouldDeferImage = Boolean(post.imageURL && isSlowConnection && !imageLoadedOverride);

  return (
    <article
      ref={cardRef}
      className={`border-b border-zinc-200 dark:border-zinc-800/80 px-4 sm:px-6 py-5 transition-colors ${
        isHighlighted
          ? 'bg-indigo-500/10 dark:bg-indigo-500/15'
          : 'hover:bg-zinc-100/40 dark:hover:bg-zinc-900/30'
      }`}
    >
      <div className="flex items-start gap-3.5">
        <button
          type="button"
          onClick={() => openProfile(post.authorId)}
          className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer"
        >
          <Avatar src={authorPhotoURL} name={authorName} size="md" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0 text-sm">
              <button
                type="button"
                onClick={() => openProfile(post.authorId)}
                className="font-semibold text-zinc-950 dark:text-zinc-100 hover:underline truncate cursor-pointer"
              >
                {authorName}
              </button>
              <span className="text-zinc-500 dark:text-zinc-400 truncate">
                @{authorUsername}
              </span>
              <span className="text-zinc-400 dark:text-zinc-600" aria-hidden="true">
                ·
              </span>
              <time
                dateTime={new Date(post.createdAt).toISOString()}
                className="text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap shrink-0 tabular-nums"
              >
                {formatRelativeTime(post.createdAt)}
              </time>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {!isOwner && currentUser && (
                <button
                  type="button"
                  onClick={() => toggleFollowUser(post.authorId)}
                  className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    isFollowing
                      ? 'text-zinc-600 dark:text-zinc-300 bg-zinc-200/70 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                      : 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10'
                  }`}
                >
                  {isFollowing ? (
                    <>
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Following</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Follow</span>
                    </>
                  )}
                </button>
              )}

              {isOwner && (
                <button
                  type="button"
                  onClick={() => deletePost(post.id)}
                  aria-label="Delete post"
                  className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {post.content && (
            <p className="mt-2 text-[15px] leading-relaxed text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap break-words">
              {renderFormattedContent(post.content)}
            </p>
          )}

          {post.imageURL && (
            <div className="mt-3 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900">
              {shouldDeferImage ? (
                <button
                  type="button"
                  onClick={() => setImageLoadedOverride(true)}
                  className="w-full py-10 px-4 flex flex-col items-center justify-center gap-2 text-center hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                >
                  <ImageIcon className="w-6 h-6 text-indigo-500" />
                  <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    Data Saver active · Tap to load image
                  </span>
                  <span className="text-xs text-zinc-500">
                    Text-first mode keeps 2G/3G feeds fast
                  </span>
                </button>
              ) : imageError ? (
                <div className="w-full py-10 px-4 flex flex-col items-center justify-center gap-2 text-zinc-500">
                  <ImageIcon className="w-6 h-6" />
                  <span className="text-xs">Image unavailable offline</span>
                </div>
              ) : (
                <img
                  src={post.imageURL}
                  alt={post.content ? post.content.slice(0, 80) : `Post by ${post.authorName}`}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  onError={() => setImageError(true)}
                  className="w-full max-h-[480px] object-cover"
                />
              )}
            </div>
          )}

          <div className="mt-3 flex items-center gap-6">
            <button
              type="button"
              onClick={() => toggleLikePost(post.id)}
              aria-label={isLiked ? 'Unlike post' : 'Like post'}
              className={`min-h-[44px] -ml-2 px-2 inline-flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer ${
                isLiked
                  ? 'text-rose-500'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-rose-500'
              }`}
            >
              <Heart className={`w-[18px] h-[18px] ${isLiked ? 'fill-current' : ''}`} />
              <span className="tabular-nums">{formatCompactCount(post.likesCount)}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowComments((prev) => !prev)}
              aria-label="Toggle comments"
              className={`min-h-[44px] px-2 inline-flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer ${
                showComments
                  ? 'text-indigo-500'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-indigo-500'
              }`}
            >
              <MessageCircle className="w-[18px] h-[18px]" />
              <span className="tabular-nums">{formatCompactCount(post.commentsCount)}</span>
            </button>

            <button
              type="button"
              onClick={handleShare}
              aria-label="Share post"
              className="min-h-[44px] px-2 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-blue-500 transition-colors cursor-pointer"
            >
              <Share2 className="w-[18px] h-[18px]" />
              <span className="tabular-nums">
                {sharedFeedback ? 'Copied' : formatCompactCount(post.sharesCount)}
              </span>
            </button>
          </div>

          {showComments && (
            <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800/80 space-y-3">
              <form onSubmit={handleCommentSubmit} className="flex items-center gap-2">
                <input
                  type="text"
                  maxLength={MAX_COMMENT_LENGTH}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Write a reply..."
                  className="flex-1 min-h-[44px] px-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={commentSubmitting || !commentText.trim()}
                  aria-label="Post comment"
                  className="min-h-[44px] min-w-[44px] px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white inline-flex items-center justify-center transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>

              {commentError && (
                <p className="text-xs text-rose-500" role="alert">
                  {commentError}
                </p>
              )}

              {comments.length === 0 ? (
                <p className="text-xs text-zinc-500 py-1">
                  No replies yet. Start the conversation.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex items-start gap-2.5 text-sm">
                      <button
                        type="button"
                        onClick={() => openProfile(comment.authorId)}
                        className="shrink-0 mt-0.5 cursor-pointer"
                      >
                        <Avatar
                          src={comment.authorPhotoURL}
                          name={comment.authorName}
                          size="xs"
                        />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 text-xs">
                          <button
                            type="button"
                            onClick={() => openProfile(comment.authorId)}
                            className="font-semibold text-zinc-900 dark:text-zinc-100 hover:underline cursor-pointer"
                          >
                            {comment.authorName}
                          </button>
                          <span className="text-zinc-500">@{comment.authorUsername}</span>
                          <span className="text-zinc-400" aria-hidden="true">
                            ·
                          </span>
                          <span className="text-zinc-500 tabular-nums">
                            {formatRelativeTime(comment.createdAt)}
                          </span>
                        </div>
                        <p className="text-zinc-800 dark:text-zinc-200 text-sm mt-0.5 break-words">
                          {comment.content}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
