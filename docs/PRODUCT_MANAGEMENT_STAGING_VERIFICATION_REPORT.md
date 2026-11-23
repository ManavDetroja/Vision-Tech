# Product management staging verification

**Passed on VisionTech-Staging (`fszrsispjxunckknphaw`), 23 November 2026.** Read-only catalog queries checked both ledger entries, function definitions and privileges. A separate database-role test used synthetic records inside a subtransaction that always rolls back. The hosted web editor stayed outside this test.

## Deployed functions

Compared remote pg_proc.prosrc against the corresponding dollar-quoted function bodies in the approved files, normalizing carriage returns. All six body fingerprints matched. Names, parameter lists, result types, owner, definer flag, configured search path and ACLs were inspected separately. Every function below is owned by postgres with search path `pg_catalog, public, auth, pg_temp`. PUBLIC and anon have no EXECUTE grant on these six functions.

| public function and argument types | Result | Mode | EXECUTE beyond owner | Matching body MD5 |
| --- | --- | --- | --- | --- |
| admin_save_catalogue_product(text,jsonb,text,boolean,timestamptz) | products | Definer | authenticated, service_role | cb93ed39ea35d15ecb7013b24aa8f16f |
| admin_create_product(jsonb) | products | Definer | authenticated, service_role | 995c26eca5eaa6c91cc2f158774044c6 |
| admin_update_product(text,jsonb,boolean) | products | Definer | authenticated, service_role | deaa5d63ff01a778bb9d5013c054292d |
| guard_product_record() | trigger | Invoker | service_role | 802c0bdb2ccc6338b4163544467607b1 |
| guard_media_registration() | trigger | Definer | none | 5ce7b763eee6dbb4d488fe3d7be37aa8 |
| review_product_media(uuid,boolean,text) | void | Definer | authenticated | 5f1a7761656cf87af980f16bb5a9e341 |

Both triggers were enabled for ordinary writes and pointed to the expected functions. The product guard restricts changes outside the editable fields, preserves identity and checks model-specific media attachments. The review function records the decision, evidence, actor and time. The service role's registry INSERT privileges cover only model, digests, MIME, byte counts, dimensions and uploader. Neither client role has direct product or registry mutation privileges.

## Staging security checks

| Check | Observed result |
| --- | --- |
| Private bucket configuration | Exactly one bucket, visiontech-product-media, public flag false, maximum object size 8,388,608 bytes; allowed JPEG, PNG and WebP. |
| Unauthorized object operations | Under both anon and authenticated STAFF roles, insertion of object metadata for the private bucket was denied. Reading, overwriting and deleting an existing synthetic object affected no accessible row or were permission-denied. Live restrictive ALL policy has the private-bucket exclusion in both USING and WITH CHECK. Storage RLS was enabled. |
| Product writes and protected fields | Anonymous and STAFF product creation failed. ADMIN created a private synthetic product with a model-matching attachment. A legacy edit attempting to confer commercial permission failed with the protected-field error. Authorized versioned publish, archive and restore succeeded. |
| Rights review | ADMIN approval denied. After promotion within the rollback fixture, the uploader still could not self-approve. An independent active SUPER_ADMIN approved the synthetic registry entry with evidence and later withdrew approval. |
| Public projection | An anonymous caller could see neither the hidden product nor its attachment. A visible product with unapproved media produced no public media row. The approved and attached control became visible to anon. Archiving the product, and later withdrawing approval after restoration, each removed the media from the public projection. |
| Registry and delivery controls | Registry RLS permits active managers to SELECT. Anonymous access is limited to the publication view, exposing id and model. Its security-barrier option and all three live predicates were verified. The reviewed API consults that view for every public GET, checks the derivative digest, and returns private/no-store. |

The fixture suite returned `product_security_suite=passed` and exit 0. It exercised database roles and policy enforcement on live staging using **metadata only**. No image bytes were uploaded, and no hosted HTTP upload, download or editor session was tested. The local end-to-end coverage is recorded in the [Prompt 11B preflight](PRODUCT_MANAGEMENT_FINAL_STAGING_PREFLIGHT.md).

## Independent cleanup

A fresh read-only session at **03:32:52 IST on 23 November 2026** found:

| Persisted state | Count |
| --- | ---: |
| Ledger entries | 10 |
| Approved versions present | 2 |
| Buckets / expected private bucket | 1 / 1 |
| Auth users / profiles | 0 / 0 |
| Products / media registry / published media | 0 / 0 / 0 |
| Storage objects | 0 |
| Enquiries / admin activity | 0 / 0 |
| Email outbox / notification delivery | 0 / 0 |

The only persistent media resource introduced by this deployment is the approved private bucket and its supporting schema. The 19-product seed remains pending separate authorization. [Deployment outcome and file hashes](PRODUCT_MANAGEMENT_STAGING_DEPLOYMENT_REPORT.md)
