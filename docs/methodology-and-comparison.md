# Agile Methodology and Related-System Review

## Project method: Agile, iterative delivery

The project is organized as short, reviewable increments rather than a one-time waterfall build. A student team can complete the following four two-week sprints; adjust duration to the course calendar.

| Sprint | Goal | Representative stories | Review / exit criteria |
|---|---|---|---|
| 0 · Discovery and risk | Agree scope, user roles, terms and privacy boundaries | “As a rural citizen, I can explain a problem without knowing a department name.” “As a Panchayat worker, I need the ward and category to route it.” | Stakeholder map, bilingual field names, draft process/state machine, consent and public-data rules, testable backlog. |
| 1 · Intake and identity | Deliver a working vertical slice | Citizen can register/login, file a category/ward complaint, get a tracking ID, attach an optional safe image. | API tests for validation/auth; mobile-sized form review in English and Kannada; private fields absent from public endpoint. |
| 2 · Work queue and accountability | Add the official workflow | Official can assign, add a remark and move a complaint through its lifecycle; admin can manage categories, wards, officers and users. | Every assignment/status change has an audit event; illegal transitions and inactive users are rejected. |
| 3 · Transparency and evidence | Add outcomes and deployment readiness | Citizen tracks, rates a resolved complaint; public sees summary-only queue; admin imports CSV and sees trends. | API/manual acceptance table passes; analytics formulas agreed; README deployment rehearsal completed. |

### Working practices

1. Keep a prioritized backlog with a short definition of done per story (validation, role check, audit event, visible loading/error/success state and test where applicable).
2. Review a working slice with a citizen representative and Panchayat staff each sprint. Test low-bandwidth Android-sized screens and Kannada text expansion; do not rely only on desktop screenshots.
3. Use a simple Kanban/Sprint board: `Backlog → Ready → In progress → Review → Done`. Limit work in progress; demonstrate an increment rather than reporting only hours spent.
4. Maintain a risk register for privacy, staff adoption, connectivity, spam, accessible language and free-hosting sleep/limits. Record decisions in a short architecture decision log.
5. At sprint review, record stakeholder feedback as a backlog item and retest changed flows. Obtain consent before collecting any primary data; do not use real names/photos in the synthetic seed.

### Definition of done

A feature is done only when the API validates it, the role boundary is enforced server-side, its state is visible in English and Kannada, loading/empty/error/success states are usable on a narrow screen, the relevant audit trail exists, and an automated or documented manual test has passed.

## Related-system review

This comparison is a **feature/scope review**, not a claim that a student prototype is more capable or authoritative than production government systems. Public pages checked on 2 October 2026; features evolve, so verify the linked portals before publication.

| System | Stated purpose and visible capabilities | What GramSetu borrows | Local academic adaptation / potential improvement |
|---|---|---|---|
| **CPGRAMS** (Government of India) | Centralised public grievance redressal across Ministries/States; citizens receive a unique registration ID and can track status. Official portal describes 24×7 registration, role-based access, mobile/UMANG access, appeal and post-closure feedback. The Government also describes language support across 22 scheduled languages. [Portal](https://pgportal.gov.in/) · [Government release](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2296724&reg=48&lang=1) | ID-based tracking, role-aware processing, feedback after closure. | Keeps the use case at Gram Panchayat scale: ward/village selection, local service categories, category-specific SLA, in-app deadline escalation and an anonymized public status board. It is a complement/academic design, not a replacement or CPGRAMS integration. |
| **eGramSwaraj** (Ministry of Panchayati Raj) | Panchayat planning, work-based accounting and reporting. Its official planning dashboard lists action-plan, activity, expenditure, asset and related reports. [Planning dashboard](https://egramswaraj.gov.in/planningDashBoard.do) | Panchayat-centered administration, role-based staff workflows and public-interest reporting. | Adds a citizen grievance intake and resolution lifecycle rather than accounting/planning modules. Ward-level queue, grievance-specific deadlines and public pending/resolved summaries are the project’s focused scope. |
| **Janaspandana – Karnataka iPGRS** (Centre for e-Governance, Government of Karnataka) | Statewide multi-mode grievance system for services/schemes across 40+ departments; Karnataka’s CEG overview describes mobile-based OTP registration, unique-ID status tracking and a 1902 call centre. [CEG overview](https://ceg.karnataka.gov.in/Blog/public/details/ipgrs/en) · [State portal](https://ipgrs.karnataka.gov.in/) | A clear registration/reference flow, status tracking and a phone-friendly access model. | Narrows the prototype to a village Panchayat workflow and supports local ward-level operational trends, category SLA escalation and a privacy-aware public transparency view. Citizens should still use the official Karnataka system for matters outside a Gram Panchayat’s jurisdiction. |

### Comparison matrix (intended capability in this prototype)

| Capability | CPGRAMS | eGramSwaraj | Karnataka iPGRS | GramSetu prototype |
|---|---|---|---|---|
| Primary scale | Central Ministries / States | Panchayat planning, accounting, reporting | State departments and schemes | One Gram Panchayat / ward-level demo |
| Unique ID + track | Yes | Not its primary grievance workflow | Yes | Yes (`GS-YY-NNNNNN`) |
| English + Kannada interface | National multilingual service; current government material describes 22 scheduled languages | Portal/report availability depends on published content | State service in Karnataka; verify portal language options | English/Kannada UI dictionary and bilingual category/ward masters |
| Mobile-first citizen workflow | Mobile app / UMANG access described by CPGRAMS | Responsive portal/report tools | Multi-mode access described by CEG | Responsive complaint form, queue and tracking view |
| Ward-level trend / assignment | Central or department routing | Panchayat activity reports | Department-level state grievance scope | Ward/village filter, owner assignment and ward analytics |
| Deadline auto-escalation | Policy/workflow features vary; confirm current implementation | Not the portal's central grievance feature | State-level process; public CEG page describes tracking/call-centre follow-up | Explicit SLA sweep, escalation event, high-priority flag and notification |
| Public pending/resolved complaint summaries | Aggregate/public features depend on current CPGRAMS views | Public planning/accountability reports, not a grievance board | Public site features may change; this comparison does not infer an absent feature | Public redacted status list with no citizen identity or GPS |
| Resolved feedback | Yes | Not the primary grievance use case | Follow-up is described; see current service rules | One rating/comment after resolution |

**Interpretation:** the contribution is integration of these local workflow choices in one small prototype, not proof of faster or more effective government redress. Production CPGRAMS/Janaspandana have broader jurisdiction, staffing, policies and channels. Any pilot should route out-of-scope matters to official systems and clearly identify this project as non-governmental.

## Outcome measurement plan

Measure outcomes using a time-bounded pilot and report both numerator and denominator:

- **Complaints handled:** number received, resolved, rejected and still open during the pilot, separated by portal submissions and CSV backfill.
- **Average resolution time:** mean and median elapsed hours from `created_at` to `resolved_at` for resolved complaints; also report the resolved-case denominator and category. Open complaints are not removed from the pending/SLA denominator.
- **Deadline performance:** active cases resolved before SLA / active cases due in the period; count and percent escalated.
- **Citizen satisfaction:** response count, average 1–5 rating, distribution by rating, and survey response rate (feedback responses / resolved complaints). Do not report an average without its sample size.
- **Adoption/access:** citizen completions versus starts, assisted/offline submissions, Kannada versus English use if collected, and staff task-completion time.
- **Equity checks:** compare completion and response times by ward/category without publishing small cells that could identify a person.

The dashboard calculates these from its records. The seeded dataset has **28 synthetic rows** (16 resolved, 11 active/pending, 1 rejected); its four synthetic feedback ratings average **4.5 / 5** and resolved records average approximately **7.4 days**. These figures are for testing only—not actual field outcomes, not official data, and not a claim about satisfaction. No real pilot results are included in this repository.
