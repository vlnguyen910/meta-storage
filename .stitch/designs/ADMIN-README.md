# StoreX — Admin Stitch imports

Project: `15161264923633714884` (Remix of StoreX Storage Finder).

| Screen | Stitch ID | Local source |
| --- | --- | --- |
| SA01 — Tổng quan quản trị | bb893bba817e4036aa998362c03af616 | sa01.jpg |
| SA02 — Tài khoản & vai trò | 8ff182f0662546289d0b666f84e89022 | sa02.html, sa02.png |
| SA03 — Phân quyền theo cơ sở | f110ce560ebb4d45a5857d2168b42d5c | sa03.html, sa03.png |
| SA04 — Lịch sử đăng nhập | 955824b2a8324ab1a7f690d562bba7ed | sa04.html, sa04.png |
| SA05 — Nhật ký hoạt động | 351579bcc4bc493a83310355c31e8068 | sa05.png |

Downloaded hosted assets using native curl with redirects and compression. SA01 and SA05 HTML URLs redirected to Google sign-in rather than source HTML; those invalid responses were not imported. Their React implementations use the actual downloaded screenshots as references. SA01 image bytes are JPEG despite the hosted PNG name.

React implementation: `apps/web/src/features/administration`, actor shell/routes under `modules/system-administrator` and `app/system-admin`.

Normalized all five screens to one emerald/white shell and fixed navigation. Removed generated claims or unconfirmed features: WORM/checksum/ISO/SOC, automatic IP blocking/lock thresholds, dynamic role editing, pricing, task dispatch, shifts and infrastructure controls.

Data is independent local mock data, shared through TanStack Query during the browser session. Reload resets the demonstration. No Admin API calls or changes to real authentication/authorization. FS multi-facility policy is TBD; the prototype explicitly rejects multi-facility selection for FS without asserting a production business rule. FM supports multiple mock facilities. Logs are read-only, IP is masked, no credentials/tokens/payment details are exposed.

No E2E runner is used. Unit/type/lint checks and browser visual inspection are separate from the user's manual test workflow.
