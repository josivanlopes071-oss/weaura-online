# Security Specification: WE AURA

## 1. Data Invariants
- **User Integrity**: Users cannot modify their own currency (`coins`), experience (`xp`), or `level`. These are only modifiable by system logic (or admin, if implemented).
- **Relational Ownership**: A room can only be deleted by its owner.
- **Message Integrity**: A message cannot be spoofed; the `authorId` must match the authenticated user.
- **Temporal Strictness**: All `createdAt` and `updatedAt` fields must use server-side timestamps (`request.time`).
- **ID Safety**: All document IDs must be alphanumeric and length-restricted.

## 2. The "Dirty Dozen" (Malicious Payloads)

### User Fraud
1. **Coin Injection**: Authenticated user attempts to set `coins: 999999` on their profile.
2. **Level Skip**: Authenticated user attempts to set `level: 100` on their profile.
3. **Ghost Identity**: User creates a profile with a `uid` that doesn't match their auth token.

### Room Hijacking
4. **Owner Theft**: User attempts to update a room's `ownerId` to themselves.
5. **Admin Spoofing**: User attempts to set a custom `role` or `isAdmin` field if it existed.
6. **ID Poisoning**: Creating a room with a 2MB string as ID.

### Chat & Social Spam
7. **Message Spoofing**: User A sends a message with `authorId: userB_id`.
8. **Spam Injection**: Sending a message with 1MB of text.
9. **Relational Orphan**: Sending a message to a non-existent room ID (path traversal attempt).

### Game Session Manipulation
10. **Winner Injection**: A player setting themselves as `winnerId` before the game ends.
11. **State Corruption**: Sending an invalid `gameType` value.
12. **Future Timestamp**: Sending a `createdAt` timestamp from the future.

## 3. Test Scenarios (Pseudo-test)
- `PERMISSION_DENIED` on all "Dirty Dozen" payloads.
- `ALLOW` only whitelisted fields for profile updates (bio, photoURL, displayName).
- `ALLOW` creating messages only if whitelisted fields are present and types are correct.
