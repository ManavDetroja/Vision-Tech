# Prompt 11B — staging migration approval review

**Ready to request staging approval for the migration pair.** The earlier read-only preflight verified eight deployed versions and an empty staging product catalogue. This milestone used a disposable local database. No fresh remote state, migration preview or seed execution is claimed.

| Order | Pending migration | SHA-256 |
| --- | --- | --- |
| 1 | [20261122000300_product_editor.sql](../supabase/migrations/20261122000300_product_editor.sql) | `31EF51010C7A573BE825633B37A0A8498A1109C5C53E2F6296790AA7D7FF5D54` |
| 2 | [20261123000100_product_media_security.sql](../supabase/migrations/20261123000100_product_media_security.sql) | `197D641A02DEAD7A3F3C24F29290B681E3E8539EEBD618F55F26C5538C341ADB` |

The second file adds the private bucket, restrictive Storage policy, product_media registry/RLS, publication view, registration and product-field triggers, and separate rights-review RPC. It replaces the two legacy product write functions while retaining their signatures. Legacy updates must carry the expected version. Both files must precede exposing the hosted editor. The first migration may archive previously retired models. Verify any affected rows immediately before a deployment.

## Local evidence

| Check | Actual result |
| --- | --- |
| Clean install | Supabase CLI 3.1.0 applied all ten migrations to vt-p11b-local. An intermediate migration contained a malformed SQL dollar delimiter. The corrected file above passed the clean rebuild. |
| Regression | All 48 Node tests passed. Fresh final pgTAP run: 21/21 RLS, 18/18 enquiry, 12/12 staff and 9/9 notification assertions. The product-edit fixture now uses the versioned contract. |
| Authorization | Anonymous and STAFF writes denied; disabled login denied. Both active manager roles exercised legitimate operations. All three product RPCs and the admin API rejected protected edits. Direct metadata PATCH/DELETE denied for anonymous, STAFF, ADMIN and SUPER_ADMIN. Direct self-review denied. |
| Catalogue | 19 published baseline identities, three exclusions, archived admin change retained after reseed. Edge verified 19 detail pages with placeholders and 19 matching enquiry prefills against the real disposable API. No enquiry was submitted. |
| Private storage | Synthetic PNG accepted; invalid media, missing submission confirmation, oversize payload and unauthorized uploads rejected. Duplicate upload returned the same asset. Authenticated private preview worked. Public GET denied before approval and after archive/withdrawal. Independent approval returned an approved ID and the normalized JPEG through the digest-checked delivery path. Direct client reads/writes, replacement and deletion denied at Storage. |
| Recovery | Private original and derivative restored and read back. Matching product and registry metadata restored in a separate rolled-back pg_dump rehearsal. [Procedure](PRODUCT_IMAGE_STORAGE_IMPLEMENTATION_REPORT.md) |
| Cleanup | CLI stopped only vt-p11b-local with backups disabled. Independent Docker checks found 0 matching containers and volumes. Temporary backup directories, package and disposable project directory were absent after cleanup. |

The integration harness is [product-storage-local.mjs](../services/tests/product-storage-local.mjs); it requires a fresh, unlinked vt-p11b-local project, local Supabase CLI/Docker, Python/Pillow and Playwright with Edge. It exercises actual API, database and Storage operations and is deliberately excluded from routine unit-test discovery.

## Planned remote dry run and approval gate

1. Confirm both linked metadata and the explicit target are VisionTech-Staging, reference fszrsispjxunckknphaw. Recalculate both file hashes. Read the remote ledger and expect the eight versions ending in 20261122000200. Check recovery coverage, existing bucket/policy/object names, retired model visibility, and current catalogue rows. Stop on drift or name collisions.
2. In the project directory run **only** the preview before considering deployment:

   ```powershell
   supabase db push --remote=fszrsispjxunckknphaw --dry-run --skip-vault --workdir "C:\Vision Tech"
   ```

   Capture output; require exactly the two filenames above in order. No seed, role change or additional migration belongs to that operation. Confirm the remote ledger remains unchanged. Obtain explicit approval for those hashes and that target.
3. Following a separately approved deployment, verify both ledger entries, RPC bodies/owners/grants/search paths, product and asset RLS, private bucket flag, restrictive Storage policy and denied direct writes. Keep the editor disabled if the second migration fails; inspect the ledger and request a recovery decision. Do not automatically repair or rerun. Review a backup before any corrective migration.
4. Obtain separate approval for the product-only seed and confirm the resulting public catalogue. Publish only the prepared static directory; route media through the authorized API. Run hosted smoke checks before enabling staff access.

**Owner decisions:** approve or defer the migration pair after a fresh preview; separately approve the 19-record placeholder seed; designate an independent SUPER_ADMIN reviewer and acceptable rights evidence; select the backend/proxy and encrypted backup destination, retention period and restore operator. The existing 40 baseline photographs still have no documented commercial clearance. They were neither uploaded nor approved here.

**READY FOR STAGING APPROVAL**
