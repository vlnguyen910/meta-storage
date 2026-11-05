# Payment return recovery

SePay uses server-generated web return URLs. Reservation checkout uses the initiating
HTTP(S) Origin only when it exactly matches AUTH_TRUSTED_ORIGINS. Native requests
without a web origin, or untrusted origins, fall back to WEB_URL. The server signs
the chosen callback URLs before returning the checkout form. Payment status and
ownership always come from the authenticated API, never the callback's `status` parameter.
No payment or checkout API contract changes are required for this recovery flow.

## Web

- The public payment result waits for authentication recovery before offering sign-in.
- Sign-in and protected routes preserve both payment and reservation identifiers.
- An authenticated customer can read a result without checkout state in that tab.
- `/customer/payments/result` is explicitly the web flow, even when the browser has
  navigation information saved from a mobile checkout.
- Browser cookies and storage do not transfer between localhost, LAN IPs or domains.
  Add each supported web origin to AUTH_TRUSTED_ORIGINS. New reservation checkouts
  return to that initiating origin; the frontend never edits signed form fields.
  Previously issued checkout forms retain their original callback. For an already paid
  transaction, open the same result path/query on the original web origin, or sign in
  on the callback origin. Do not pay again to recover a result.

## App

- Before opening checkout, the app saves the payment reference under the current owner.
- Cold start and a background-to-active transition restore a valid saved payment route.
- Returning to the foreground refreshes API queries; an existing payment screen keeps
  its stack instead of adding duplicate screens.
- Deep links also restore the payment. Late storage reads and events from a previous
  account cannot replace a newer return or the current account's recovery.
- The mobile bridge stores the validated return URL in sessionStorage and localStorage
  so another tab on the same origin can recover an Expo/native return.
- Without saved browser navigation, the public page offers the registered
  `metastorage://payment-result` link plus web sign-in. Expo Go users can switch back
  manually; native app recovery does not require that browser link to work.
- Pending or unreachable payments remain available for checking again. Existing API
  responses drive success, failure and refund states; recovery does not create a charge.

## Manual checks

Use the existing sandbox configuration, with the API, web and Expo host reachable.

1. Web: finish checkout in the same tab and verify the result from the API.
2. Web: open the result in another tab. If sign-in is needed, verify the original
   payment/reservation remain in the result URL after sign-in.
3. App: open checkout, finish payment and manually switch back to the app. Verify the
   payment screen refreshes without creating another payment.
4. App: close/reopen the app while checkout is pending and verify recovery for that owner.
5. App: try the browser return link. In Expo Go, also verify manual return works when
   the browser cannot open the app automatically.
6. Open "Xem kết quả trên web" from a mobile return and verify web sign-in/result works.
7. Cancel checkout, lose network, and switch accounts: do not show success from the
   URL, erase pending recovery on network errors, or restore another owner's cached task.
