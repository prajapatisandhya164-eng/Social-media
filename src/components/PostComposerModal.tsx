import React, { useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { Avatar } from './Avatar';
import { compressImageFile } from '../utils/imageCompression';
import { formatBytes } from '../utils/formatters';
import {
  extractHashtags,
  MAX_POST_LENGTH,
  validateWithServerOrFallback,
} from '../utils/validation';

interface PostComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  isSlowConnection: boolean;
}

export function PostComposerModal({
  isOpen,
  onClose,
  isSlowConnection,
}: PostComposerModalProps) {
  const { currentUser, createPost } = useSocial();
  const [content, setContent] = useState('');
  const [imageURL, setImageURL] = useState<string | undefined>(undefined);
  const [compressionNote, setCompressionNote] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !currentUser) return null;

  const detectedTags = extractHashtags(content);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setCompressing(true);
    try {
      const result = await compressImageFile(file, {
        lowBandwidth: isSlowConnection,
      });
      setImageURL(result.dataUrl);
      setCompressionNote(
        `Optimized ${formatBytes(result.originalSize)} → ${formatBytes(result.compressedSize)}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to process image.');
    } finally {
      setCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const check = await validateWithServerOrFallback({
        type: 'post',
        content,
        hasImage: Boolean(imageURL),
      });
      if (!check.valid) {
        setError(check.error || 'Please add text or an image.');
        return;
      }
      await createPost({
        content: check.sanitizedContent || '',
        imageURL,
      });
      setContent('');
      setImageURL(undefined);
      setCompressionNote(null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not publish post.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Create post"
    >
      <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl overflow-hidden">
        <div className="sm:hidden w-10 h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto mt-3" />

        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="font-display text-base font-semibold text-zinc-950 dark:text-white">
            Create Post
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close composer"
            className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <Avatar src={currentUser.photoURL} name={currentUser.displayName} size="sm" />
            <div className="flex-1 min-w-0">
              <textarea
                rows={4}
                maxLength={MAX_POST_LENGTH}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Share an update, idea, or moment... Use #hashtags to reach Discover."
                className="w-full bg-transparent text-[15px] text-zinc-950 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none resize-none"
                autoFocus
              />
            </div>
          </div>

          {detectedTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400">
              {detectedTags.map((tag) => (
                <span key={tag}>#{tag}</span>
              ))}
            </div>
          )}

          {imageURL && (
            <div className="relative rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
              <img
                src={imageURL}
                alt="Selected upload preview"
                className="w-full max-h-64 object-cover"
              />
              <button
                type="button"
                onClick={() => {
                  setImageURL(undefined);
                  setCompressionNote(null);
                }}
                aria-label="Remove image"
                className="absolute top-2.5 right-2.5 min-h-[36px] min-w-[36px] rounded-full bg-black/70 text-white inline-flex items-center justify-center hover:bg-black transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              {compressionNote && (
                <p className="px-3 py-1.5 text-[11px] text-zinc-300 bg-black/70 tabular-nums">
                  {compressionNote}
                </p>
              )}
            </div>
          )}

          {error && (
            <p className="text-xs text-rose-500" role="alert">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={compressing}
                className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-medium border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 inline-flex items-center gap-2 transition-colors cursor-pointer"
              >
                {compressing ? (
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                ) : (
                  <ImagePlus className="w-4 h-4 text-indigo-500" />
                )}
                <span>{compressing ? 'Compressing...' : 'Add Photo'}</span>
              </button>
              <span className="text-xs text-zinc-400 tabular-nums">
                {content.length}/{MAX_POST_LENGTH}
              </span>
            </div>

            <button
              type="submit"
              disabled={submitting || compressing || (!content.trim() && !imageURL)}
              className="min-h-[44px] px-5 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-indigo-600 via-violet-600 to-blue-600 hover:brightness-110 transition-all disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Publishing...' : 'Post'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
