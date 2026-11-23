# Staging product image backup and recovery verification

**23 November 2026 — encrypted byte recovery rehearsal passed; operational backup pending owner selection.** No independent backup provider, destination, retention period or recovery-key custodian was selected. No scheduled backup or recoverable off-site copy was configured.

## Actual recovery rehearsal

The workstation read back the exact synthetic original and normalized derivative from the private staging bucket before creating the rehearsal backup. The following hashes were checked against the inputs and the recovered files.

| Bytes | Length | SHA-256 |
| --- | ---: | --- |
| Original PNG | 77 | `aa61496a297378d5352182f533b941d4c9fe8baae9e02baac8efee8f5aee5500` |
| Processed JPEG | 634 | `533c812481648b910a4c0c27eec1c937f0018e7c391a85cd5957c4c51fa3cdf0` |

1. The test encrypted the two byte streams and their digest inventory using AES-256-GCM with a fresh in-memory key and nonce. It wrote a 1,187-byte authenticated envelope into a newly created local temporary directory outside the repository.
2. It read the envelope from disk. A changed ciphertext byte failed authentication. The unaltered envelope decrypted successfully. Both restored files were created exclusively in the disposable directory and matched their original SHA-256 values on a second read. Attempting to create either restore target again returned `EEXIST`.
3. The test deleted the staging fixture objects, encrypted envelope and both local restore files. It verified the local directory and exact staging keys were absent. A separate database session confirmed zero Storage objects and zero media rows. The ephemeral key was discarded.
4. This exercised encrypted byte restoration to a disposable filesystem. Provider retention, independent key recovery, a scheduled job, recovery from loss of the staging project, and metadata-plus-bytes restoration from that provider remain untested. The fixture intentionally had no registry record. The existing registry-based exporter was reviewed and was not used as evidence for this byte rehearsal.

## Configure once the owner selects the destination

| Owner decision | Needed for operation |
| --- | --- |
| Destination and responsibility | Name the backup account/provider or separately administered encrypted volume, region and private destination. Identify the backup operator and restore approver. Use an independent failure domain and credentials distinct from the application. |
| Retention | Approve the maximum acceptable data loss, recovery time, snapshot frequency, version retention, deletion protection and expiry. Set alerts for missing, incomplete or stale exports and schedule restoration drills against those targets. |
| Encryption and access | Select the encryption/key-management arrangement, key custodian, recovery delegate and recovery procedure. Restrict backup write and restore access separately where supported. Store keys in the designated secret manager and verify a recovery operator can decrypt without the staging host. |

## Operational backup and restoration procedure

- Quiesce uploads, attachment edits and rights reviews during a consistent snapshot. Capture matching database metadata and dependencies, including products, media registry, rights decisions, audit records, profiles, schema and access policies. Inventory Storage keys against the registry to detect orphan objects. Supabase database metadata alone cannot recover the bytes.
- Run `services/product-media-backup.mjs backup <new-external-directory> fszrsispjxunckknphaw.supabase.co` with Node and the staging server environment on an encrypted mount. The utility verifies both digests and writes its manifest last. It writes plaintext files at the filesystem layer and depends on destination encryption. Putting that directory on the application disk alone would leave recovery dependent on the same host.
- Transfer the completed snapshot and matching database export to the approved independent destination using authenticated encryption and least-privilege credentials. Protect the manifest and record its authenticated digest, object count, byte counts, database snapshot reference, key identifier and timestamp. Verify a fresh read from the destination and apply the approved retention settings.
- Rehearse recovery on an isolated local Supabase stack. Recover the matching database metadata, identities and restrictive private bucket first. Decrypt the snapshot on a protected volume, verify the manifest, and run the repository utility with `restore-local <snapshot-directory> 127.0.0.1` and disposable credentials. It uses create-only object writes and reads the content back to check each digest. Stop on a conflicting object. Confirm original bytes, normalized bytes, row-to-object relationships, manager access and public denial before accepting recovery. Remove disposable copies according to the selected policy.

The earlier local implementation test exercised registry-backed exports and restoration into disposable Supabase. That test and this encrypted rehearsal cover separate parts of the procedure. A verified independent backup and a restore from it are still required for hosted editor readiness. [Prior implementation and local restore](PRODUCT_IMAGE_STORAGE_IMPLEMENTATION_REPORT.md) · [Hosting verification](PRODUCT_IMAGE_HOSTING_CONFIGURATION_REPORT.md)
