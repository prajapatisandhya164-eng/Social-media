/**
 * Payload-First Security TDD suite verifying the Dirty Dozen payloads against firestore.rules.
 * Run with @firebase/rules-unit-testing when a local Firestore emulator is available.
 */
export interface DirtyDozenCase {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expected: 'PERMISSION_DENIED';
  description: string;
}

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unverified Email Spoof',
    collectionPath: '/posts/post_001',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Reject writes when request.auth.token.email_verified is false.',
  },
  {
    id: 2,
    name: 'Shadow Field Injection',
    collectionPath: '/users/user_a',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Reject extra unapproved fields such as isAdmin or role via hasOnly().',
  },
  {
    id: 3,
    name: 'PII Snooping',
    collectionPath: '/users/user_a/private/info',
    operation: 'get',
    expected: 'PERMISSION_DENIED',
    description: 'Reject read of private PII subcollection by any user other than owner.',
  },
  {
    id: 4,
    name: 'Private Conversation Eavesdrop',
    collectionPath: '/conversations/user_a__user_b/messages/msg_1',
    operation: 'get',
    expected: 'PERMISSION_DENIED',
    description: 'Reject message access by non-participant User C via Master Gate.',
  },
  {
    id: 5,
    name: 'Fake Sender Spoofing',
    collectionPath: '/conversations/user_a__user_b/messages/msg_2',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Reject message where senderId does not equal request.auth.uid.',
  },
  {
    id: 6,
    name: 'Orphaned Comment Write',
    collectionPath: '/posts/nonexistent_post/comments/c1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Reject comment when parent post document does not exist.',
  },
  {
    id: 7,
    name: 'Post Content Tampering',
    collectionPath: '/posts/post_001',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    description: 'Reject non-author trying to modify post content or hashtags.',
  },
  {
    id: 8,
    name: 'Fake Counter Inflation',
    collectionPath: '/posts/post_001',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    description: 'Reject likesCount jump > 1 or missing atomic like document.',
  },
  {
    id: 9,
    name: 'Client Timestamp Forgery',
    collectionPath: '/posts/post_002',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Reject createdAt values that do not equal server request.time.',
  },
  {
    id: 10,
    name: 'ID Poisoning',
    collectionPath: '/posts/invalid$id*chars',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Reject malformed or oversized document IDs via isValidId().',
  },
  {
    id: 11,
    name: 'Unbounded Hashtag Array',
    collectionPath: '/posts/post_003',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Reject hashtags array exceeding 10 items or containing non-string entries.',
  },
  {
    id: 12,
    name: 'Cross-User Notification Read',
    collectionPath: '/notifications',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
    description: 'Reject notification queries not scoped to resource.data.recipientId == request.auth.uid.',
  },
];
