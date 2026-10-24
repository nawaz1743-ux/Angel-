# Angel Project Status & Continuity Rules

Last updated: 2026-10-25
Default branch: main
Repository: https://github.com/nawaz1743-ux/Angel-

> IMPORTANT: This file is a continuity record, not proof that any feature currently works. Every status below is based on the latest information available in conversation and must be checked against current source code, commits, workflow runs, and tests before being treated as verified.

## Non-negotiable development rules
- Do real implementation; do not make cosmetic/random changes merely to get a green build.
- A green build means only that configured build steps passed. It does NOT prove feature correctness.
- Never mark a feature complete until its implementation and relevant tests have been inspected and test results recorded.
- Do not claim a commit, build, APK, deployment, or test exists unless it is verified in GitHub or the relevant environment.
- Do not make unapproved design or scope changes.
- Work phone-friendly: user primarily uses a Samsung Android phone and does not use a PC/laptop.
- User prefers concise Roman Hindi/Hinglish explanations and exact actionable results; do not repeatedly ask the user to paste code if repository tools can inspect it.
- Keep API keys and secrets out of source files, logs, chat replies, and committed documentation.
- After each coding task: inspect the diff, run available relevant tests/build, record exact results and commit/run identifiers, then update this file.
- If a test cannot be run, label it NOT RUN; do not imply it passed.
- When continuing in a new chat, read this file and inspect the latest repository state and Actions runs before coding.

## Last known project baseline (historical; verify before relying on it)
- Android app name: Angel
- Android project path: `android-angel/`
- Namespace/applicationId: `com.angel.assistant`
- Kotlin + Jetpack Compose
- minSdk 26; compileSdk 35; targetSdk 35
- Previously reported successful build: GitHub Actions run #131 (reported by user around 2026-10-21). This is NOT a verification of the latest commit or current code.
- Workflow previously identified: `.github/workflows/android-build.yml`, workflow name "Angel Android APK Build", artifact name `Angel-Android-APK`. Verify current workflow before use.
- Gemini API key was previously supplied through a GitHub Secret / BuildConfig setup. Do not expose the secret. Server-side proxy security was previously discussed; current implementation status must be inspected and verified.

## Product requirements recorded from prior discussion
- Default interaction language: Roman Hindi/Hinglish first, English second; avoid Devanagari Hindi in Angel UI/responses where feasible.
- Female voice should sound natural and read the full response without stopping.
- Wake word requested: "Angel" (not "Hey Angel"); implementation/licensing and real-device behavior must be verified before claiming it works.
- Home screen direction: menu at top-left; Angel name centered; language selector; settings moved into Menu; no duplicate Ads entry; Hands-Free in Menu; central mic remains main input; remove redundant top back arrows where Android back is intended; retain developer credit and approved Angel artwork.
- Menu includes Chat, Voice Assistant/Hands-Free, Calling/Dialer, WhatsApp, Screen help, Smart Ads Manager, Reminders & Alarms, Task Manager, To-do List, and Settings, without duplicated Task Manager/To-do entries inside Reminders & Alarms.
- Voice bug reported: after mic input, transcript appears but listening state remains too long and response is delayed. Diagnose from current source and logs; do not assume fixed.
- AI model selection discussed: primary model described by user as "3.8" and one alternative "3.5 Flash Lite". Verify actual supported model identifiers before implementation; do not display an unverified name.
- Smart Ads Manager: Google Ads and Meta account integration; analyze campaigns and suggest drafts; publishing, budget, or targeting changes require explicit user approval.
- API security: goal is server-side API proxy; do not put private API keys in APK/client code. Verify current architecture and deployment endpoint before calling this complete.
- UPI/banking security must not be bypassed; Angel must not gain payment-processing authority.

## Status board (must be re-verified against current code)
Legend: VERIFIED = source and test evidence checked; IMPLEMENTED/UNTESTED = code exists but behavior not verified; PENDING = no verified completion evidence.

| Work item | Current record | Next verification required |
|---|---|---|
| Build baseline | Historical report: run #131 green | Inspect latest commit and latest Actions run |
| Server-side API key proxy | User previously said API security item was done/green, but no current source/runtime evidence checked in this session | Inspect client key use, backend proxy, secrets/config, deploy URL, and test real request without exposing keys |
| Microphone transcript/listening delay | Bug reported; no verified fix recorded here | Inspect listening state machine, duplicate request path, timeouts, logs, and run tests |
| Gemini request duplication | Previously listed for checking | Trace one user turn end-to-end and test exactly one request |
| Actual AI model display | Previously listed for checking | Verify configured model ID and UI display against supported API identifiers |
| Smart Ads live connections | Previously listed for live verification | Inspect OAuth scopes, callback, account connection, real data, approval gates; test safely |
| Reminders, alarms, dialer, task manager, to-do | User previously reported these screens became functional but objected to duplicate Task Manager/To-do entries inside Reminders & Alarms | Verify latest navigation, separation, persistence, and real device behavior |
| Wake word "Angel" | Requested; licensing and real-device behavior not confirmed | Verify implementation, licence, battery behavior, background limits, and real-device detection |
| Signed release APK | Previously listed as pending | Verify signing configuration and build artifact; never expose signing secrets |
| Automated Android tests | Previously listed as pending | Inspect test coverage and run available unit/UI tests |
| README accuracy | Previously listed as pending | Compare README claims against real implemented behavior |

## Definition of done for every feature
A feature may be marked COMPLETE only when all applicable checks are recorded:
1. Source implementation inspected.
2. Relevant unit/API/UI tests added or identified.
3. Tests executed and result recorded.
4. Build executed and result recorded.
5. Real-device/manual verification performed for device-dependent behavior, or clearly marked NOT RUN.
6. Security/privacy and failure cases considered.
7. Commit SHA and Actions run URL/number recorded when available.
8. This status file updated to reflect evidence, not intention.

## Separate project note
The restaurant food-ordering app discussed in October 2026 is a separate project and has NOT been created in this repository. Its approved plan is recorded in conversation context; create/use a dedicated repository for it rather than mixing its code or status into Angel.

## Session handoff template
- Project:
- Branch:
- Starting commit:
- Task:
- Files inspected:
- Files changed:
- Tests run and results:
- Build run and result:
- Real-device verification:
- Commit SHA:
- Actions run:
- Remaining blockers:
- Next exact task:
- Status file updated: YES/NO
