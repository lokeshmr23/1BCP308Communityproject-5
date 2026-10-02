# Testing and Measurable Evaluation

## Automated tests

Run from the repository root:

```bash
npm test
npm run build
```

`server/tests/api.test.js` starts Express on an ephemeral local port and uses an in-memory SQLite database. It exercises health, demo login, role-scoped complaint listing, citizen complaint creation/reference generation, redacted public tracking, admin assignment, status changes through resolution, citizen feedback, analytics, a forbidden citizen write, invalid input and public-field privacy. `server/tests/utils.test.js` covers state-transition rules, status normalization, ID format, deadline arithmetic and common phone/email redaction.

Last local check during project assembly: API/unit tests **2 test cases passed, 0 failed**; Vite production build succeeded. Re-run after any edits and record your own environment/version in the final report.

## Manual acceptance test matrix

`Not run` means a student/team member still needs to execute and record an observation on the actual browser/hosting configuration. For an academic submission, add device/browser, date, tester initials and evidence link/screenshot where permitted.

| ID | Actor / setup | Steps | Expected result | Execution |
|---|---|---|---|---|
| M01 | Citizen; phone viewport (360 px) | Use demo citizen, open My complaints, then file a complaint with required fields. | Form is usable without horizontal scrolling; field errors are clear; successful submission returns a unique `GS-YY-NNNNNN` reference and Submitted status. | Not run |
| M02 | Citizen; photo under 5 MB | Attach valid JPG/PNG/WebP and submit. | Photo upload completes; detail view displays an authorized, signed/local image URL. | Not run |
| M03 | Citizen; invalid photo | Choose a PDF/SVG or image over 5 MB. | UI/API rejects the file with an understandable error; complaint is not silently created. | Not run |
| M04 | Citizen | Open an owned complaint and inspect history / try a different user's ID. | Own complaint detail is visible; another citizen's private detail returns 404. | Not run |
| M05 | Official | Open an unassigned complaint and assign it to an active official with a remark. | Status becomes Assigned, officer and audit event appear; citizen and officer receive in-app notification. | Not run |
| M06 | Official | Move Assigned → In Progress → Resolved with remarks. | Each transition updates the queue and timeline; citizen gets status notification; resolution timestamp is set. | Not run |
| M07 | Official | Attempt a terminal or unsupported transition (e.g. Resolved → In Progress). | API returns conflict; existing state and audit trail are unchanged. | Not run |
| M08 | Admin | Set a due date in the past for an active test complaint; trigger API traffic or restart API. | Escalation flag/event is created once, priority is raised, assigned staff/admin receive in-app notification. | Not run |
| M09 | Citizen | Open a resolved owned complaint and submit 1–5 star feedback once. | Rating/comment saves; second submission is rejected; analytics average and count update. | Not run |
| M10 | Signed-out visitor | Open transparency and track using a public ID. Inspect JSON/browser. | Pending/resolved aggregate and summary are visible; citizen name/email/phone, exact coordinates, private description and photo are absent. | Not run |
| M11 | Admin | Add/edit category and ward in English + Kannada; try deleting one already used by a complaint. | CRUD works; bilingual names display after language toggle; referenced master data cannot be deleted. | Not run |
| M12 | Admin | Create an official, edit their ward, then disable them. | User appears in correct role list, disabled account cannot log in, audit/history remains. | Not run |
| M13 | Admin | Import sample CSV, then import an invalid row / duplicate tracking ID. | Valid records import; invalid rows show line-specific reasons; duplicates are skipped. | Not run |
| M14 | Citizen and staff | Toggle English/Kannada; test longest nav/form labels. | Core navigation, statuses and form labels switch; layout remains readable on narrow screens. | Not run |
| M15 | Deployment | Let the Render free service idle, then visit dashboard/transparency. | First API request may be slow while host wakes; retry succeeds, UI shows a recoverable connection hint. | Not run |
| M16 | Staff | Configure SMTP with a test mailbox and submit/assign/resolve. | Email is sent to configured recipients; without SMTP, in-app flow still succeeds. No SMS is sent. | Not run |
| M17 | Citizen / admin | Edit an unassigned Submitted complaint, withdraw it as citizen, then archive a test case as admin. | Citizen edit recalculates category SLA; withdrawal/archive hide the case from active/public views while preserving an audit event. Assigned/closed citizen complaint edit or withdrawal is rejected. | Not run |

## Metrics and formulas

| Measure | Formula | Display / reporting rule |
|---|---|---|
| Complaints handled | Count of complaint records created in the selected period | Split by `portal`, `synthetic-seed` and `csv-import`; do not describe imported/backfilled records as newly filed. |
| Pending | Count of `Submitted`, `Assigned` and `In Progress` | Report counts and age/SLA buckets; do not interpret pending as resolved. |
| Resolution time | `(resolved_at − created_at)` for complaints with both timestamps | Dashboard average in hours (or converted days); report median and resolved-case count in a formal evaluation because averages are skew-sensitive. |
| Escalation rate | Active or total cases with `escalated_at` ÷ cases whose deadline has passed | Define period and denominator; do not count a still-future case as on time yet. |
| Satisfaction | Mean rating (1–5) after resolution | Always report `n`, distribution and response rate (`rated resolved cases ÷ resolved cases`). An absent rating is not a zero. |
| Ward/category trend | Count of cases per selected ward/category and month | Suppress small values in public reporting if a household could be inferred. |
| Adoption / accessibility | Completed submissions ÷ started forms; completion time; Kannada use where voluntarily collected | Collect via consented usability test, not by inferring a person's language from name or location. |

### Current demo dataset — illustrative, not field evidence

The repository seeds 28 anonymized **synthetic** CPGRAMS-style examples. Based on the included CSV at project assembly:

- Total sample records: **28**
- Resolved: **16**
- Active/pending: **11**
- Rejected: **1**
- Resolved-case arithmetic mean: **119 / 16 = 7.44 days** (dates in the CSV; this is not a real service benchmark)
- Synthetic demo feedback: **4 ratings; mean 4.5 / 5** (not citizen survey evidence)
- The 11 active demo rows are past the seeded category deadlines; after the startup/API escalation sweep they are flagged as escalated. This is intentional to test the overdue dashboard, not representative performance.

Replace or disable this seed before using the app with a real Panchayat. A proper report should show the pilot start/end dates, sample sizes, baseline source, missing data, ward/category breakdown, and whether values are actual or synthetic.

## Suggested pilot success criteria (targets, not results)

Agree criteria with the Panchayat before a pilot. A reasonable first test might require: 100% of valid portal submissions receive a unique ID; no unauthorized access to another citizen's detail; zero private fields in the public route; each supported status transition has an audit event; an overdue active case is escalated at next API wake; all tested mobile and Kannada flows are usable; and a satisfaction average target such as **≥4.0/5 with at least 20 responses and response-rate denominator shown**. Do not claim an improvement in average resolution time until a comparable pre-pilot baseline is collected and analyzed.
