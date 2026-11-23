# Independent commercial image-rights review

**Staging enforces independent review. No permanent reviewer is assigned.** The final inventory contained zero Auth users and profiles after disposable account cleanup.

1. An active ADMIN or SUPER_ADMIN uploads an exact-model image for private review. The registry records uploader, model, original/derivative digests and timestamp. New images start unapproved.
2. The manager may privately preview the asset and attach or reorder its UUID. Attachment or publication alone grants no permission to serve the image.
3. A different active SUPER_ADMIN checks the actual model and the written evidence for commercial use on this retailer's website. Record a durable rights document reference in the review action; keep the underlying permission and its terms under controlled access. An official product page or a filename is insufficient.
4. The review RPC verifies the current database role, rejects approval by the uploader, and stores approval status, evidence, actor and time. It inserts the approval or withdrawal event into admin activity in the same transaction. Ordinary editors cannot set these fields through a product update. A SUPER_ADMIN can withdraw with a reason. Reapproval requires another eligible independent decision.
5. The public view requires the exact attached media ID, matching model, approved status and visible product. Each public GET rechecks that view. After withdrawal, archival or detachment the public route returns 404.

During the staging rehearsal, an ADMIN uploader and separate SUPER_ADMIN approved and withdrew **synthetic test artwork only**. The two approvals and two withdrawals were audited. Earlier staging checks verified self-approval denial at the database boundary. All fixture records were removed. The 42 original archive hashes matched their recorded values. None were uploaded or approved. [Test evidence](PRODUCT_MANAGEMENT_FINAL_TEST_REPORT.md)

**Owner action.** Nominate the uploader/manager and a different trusted reviewer. Use the existing supervised SUPER_ADMIN bootstrap procedure and existing staff workflow, confirm the two active identities and roles in staging, and establish who retains the permission evidence. Do not send passwords, tokens or recovery keys in chat. [Account bootstrap](SUPER_ADMIN_BOOTSTRAP_GUIDE.md)
