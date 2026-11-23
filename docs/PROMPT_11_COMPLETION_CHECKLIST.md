# Prompt 11 acceptance checklist

**Overall status: INCOMPLETE — external hosting, independent backup and permanent reviewer pending.**

| Category | Evidence and disposition |
| --- | --- |
| A — Verified on staging | Real disposable role logins, product create/edit/publish/archive/restore, private uploads and previews, image replacement, independent synthetic review, audited withdrawal, denial, catalogue integrity and cleanup. API ingress was local; Supabase Auth, database and Storage were hosted. |
| A — Verified in browser with staging data | Authenticated editor search and edit dialog at 375, 768 and 1440 px. All 19 published product detail routes, placeholders and enquiry prefills on a clean second run. |
| B — Implemented, external configuration pending | Single-instance Linux web service, static packaging, staging target guard, closed-by-default editor, existing supported content fields, client-encrypted backup workflow, retention and scheduled recovery verification. |
| C — Owner action | Approve staging compute and release access, independent backup destination and key custody, and the separate permanent manager/reviewer identities. |
| D — Outside existing content schema | Hero, About and footer text are source-managed. There is no arbitrary hosted content editor or approval to create new public contact details. |
| E — External acceptance blocked | Public HTTPS host deployment and ingress tests, independent account backup/restore, real custodian recovery and ordinary hosted editor activation. |

## Consolidated owner decision

1. **Host and source release.** Confirm the Render workspace, region and spending cap for one always-on instance. Choose an approved source handoff for the unpushed changes. Supply the staging HTTPS origin or authorize the provider-assigned staging origin. Set staging secrets in the host manager.
2. **Backup and recovery.** Approve a private B2 region/bucket/prefix or specify the existing equivalent. Nominate the recovery-key custodian and backup operator. Confirm 30 daily recovery points and monthly recovery drills, select a protected worker/scratch mount, and set the alert destination. Store credentials out of band.
3. **Independent people.** Nominate an authorized staging product manager and a different active SUPER_ADMIN reviewer. Authorize supervised account setup for those identities. No real contact data or licence grant is assumed.

After provisioning, test through the public staging HTTPS boundary and restore from the independent account with the custodian. Enable normal hosted editor access only after those checks pass. There is no pending migration. [Implementation](PRODUCT_MANAGEMENT_FINAL_IMPLEMENTATION_REPORT.md) · [Test results](PRODUCT_MANAGEMENT_FINAL_TEST_REPORT.md) · [Hosting](PRODUCT_IMAGE_HOSTING_FINAL_REPORT.md) · [Backup](PRODUCT_IMAGE_BACKUP_FINAL_REPORT.md) · [Rights workflow](PRODUCT_RIGHTS_APPROVAL_WORKFLOW.md)
