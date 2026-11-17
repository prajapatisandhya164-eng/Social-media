# CONNECTLY Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Master Gate & Participant Isolation**: Messages inside `/conversations/{conversationId}/messages/{messageId}` can only be read, listed, or created if `request.auth.uid` is in the parent conversation's `participantIds` (`size() == 2`).
2. **PII Isolation**: User email addresses reside exclusively in `/users/{userId}/private/info` and can only be read or written by `request.auth.uid == userId`. Public profiles at `/users/{userId}` never store emails or phone numbers.
3. **Identity & Immutability**: Authors (`authorId`, `senderId`, `actorId`, `uid`) must equal `request.auth.uid` on creation and remain immutable on update. `createdAt` must equal `request.time` on creation and never change on update.
4. **Action-Scoped Updates**: Non-owners cannot edit post content; engagement actions on `/posts/{postId}` only permit atomic `likesCount` (+/-1 synced with `/likes/{uid}`), `commentsCount` (+1 synced with `/comments/{commentId}`), or `sharesCount` (+1).
5. **Strict Volumetric & Regex Guards**: Document IDs match `^[a-zA-Z0-9_\-]+$` and `<= 128` (or `<= 260` for deterministic conversation IDs), usernames match `^[a-z0-9_]{3,30}$`, hashtags list `<= 10`, strings enforce bounded `.size()`.
6. **Verified Email Gate**: All mutations require `request.auth != null && request.auth.token.email_verified == true`.

## 2. The "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Unverified Email Spoof**: Signed-in user with `email_verified: false` attempting `POST /posts/p1`.
2. **Shadow Field Injection**: Creating `/users/{uid}` with extra field `{ "isAdmin": true }` or `{ "isVerified": true }`.
3. **PII Snooping**: User B calling `get` on `/users/{userA}/private/info`.
4. **Private Conversation Eavesdrop**: User C calling `get` or `list` on `/conversations/{convAB}` or `/conversations/{convAB}/messages`.
5. **Fake Sender Spoofing**: User A creating a message in `convAB` with `senderId: userB`.
6. **Orphaned Comment Write**: Creating `/posts/nonexistent_post/comments/c1`.
7. **Post Content Tampering**: User B updating `content` on User A's post `/posts/p1`.
8. **Fake Counter Inflation**: User B updating `/posts/p1` with `likesCount: 999999` without creating `/posts/p1/likes/{userB}`.
9. **Client Timestamp Forgery**: Creating `/posts/p1` with `createdAt` set to a past client timestamp (`!= request.time`).
10. **ID Poisoning**: Creating `/posts/bad$id*with!invalidchars` or a 200-char ID.
11. **Unbounded Hashtag Array**: Creating `/posts/p1` with 15 hashtags (`size() > 10`) or non-string element `[123]`.
12. **Cross-User Notification Read**: User B listing `/notifications` without scoping to `recipientId == userB`, or reading User A's notification.
