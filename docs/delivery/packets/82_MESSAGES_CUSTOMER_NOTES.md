# Packet 82 — Messages and customer-note continuity

## Objective

Finish the two communication records RIVT currently presents as durable:

1. accepted-work Messages between the two real participants; and
2. private notes attached to a canonical Contact.

The packet replaces browser-only preferences and photo data URLs with
account-owned records without turning private customer notes into outbound
messages.

## Acceptance boundary

- Message attachments are uploaded to managed private storage, authorized to
  conversation participants, attached atomically to a real server message,
  readable through short-lived signed URLs, removable by their sender, and
  never represented as delivered before the message write succeeds.
- A failed or cancelled upload remains a visible local draft that can be
  retried or removed. It is not described as sent or synced.
- Conversation pin/archive preferences and reusable message templates follow
  the account across devices.
- Message reactions are server-owned participant state. Counts come only from
  persisted reactions, and a participant can add, replace, or remove their own.
- Customer notes belong to one canonical Contact and the owning account.
  They support create, edit, archive, restore, history, private media,
  signed reads, removal, loading/error/retry, and explicit legacy migration.
- Customer notes remain labeled private and are never delivered to the
  Contact. A Contact linked to a RIVT account still uses Messages for actual
  participant communication.
- Legacy browser templates, pins, archives, reactions, note text, and photo
  data remain on the device until an explicit migration finishes.
- All new media rejects embedded image GPS metadata before storage.

## Schema and authorization

- Migration `0040_messaging_customer_notes` adds account-owned conversation
  preferences, templates, reactions, Contact notes, note attachments,
  continuity events, attachment lifecycle fields, and private upload scopes.
- Conversation reads/writes require an active conversation participant.
- Message attachment removal requires the original sender/creator.
- Contact-note reads/writes require the Contact and note to belong to the
  authenticated account.
- Optimistic versions and idempotency protect correction and multi-device
  mutation paths.

## Rollback

Apply `0040_messaging_customer_notes.down.sql` only after rolling the
application back. It detaches new message/contact-note objects, marks their
upload records removed, restores the prior upload-scope constraint, removes
new attachment lifecycle columns, and drops only Packet 82 tables.

## Required evidence

- Build, lint, unit, all serial integration suites, E2E, rendered mobile and
  desktop checks, migration rollback/reapply, and dependency audit.
- Production exact-source health with migration `0040` ready.
- Disposable authenticated production proof covering two-party attachment
  access/reaction/preferences plus private Contact-note CRUD/media/isolation
  and cleanup.

## Three-things review

1. **Abandoned managed drafts:** a user can close the app after upload but
   before send. Packet 82 now gives staged message attachments a 24-hour
   authorization window, rejects expired IDs during send, and performs
   bounded object/database cleanup when authenticated messaging resumes.
2. **History versus archive:** an Archived toggle is recovery, not edit
   history. Customer notes now expose the immutable continuity-event timeline,
   including create, correction, archive/restore, and attachment changes,
   through an owner-authorized endpoint and inline History control.
3. **Legacy chronology:** imported note text could persist while its original
   date was lost at the response boundary. The server now maps `occurredAt`,
   the client sorts/displays that value, and integration coverage locks it.

No additional record silo, fabricated delivery state, or public Contact
surface was introduced by these closures.
