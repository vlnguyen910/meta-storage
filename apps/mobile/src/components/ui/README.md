# Mobile components

Import the UI foundation from `src/components/ui`. Components use the existing mobile tokens,
fonts and Lucide icons. They do not fetch data, navigate, or manage sessions.
`AppHeader` uses `assets/logo/logo.png` with the **MetaStorage** wordmark. It is transparent
and has no divider, so the containing screen controls the canvas.

```tsx
import {
  AppHeader, BottomTabs, Button, Card, Heading, ListItem, SearchField, ScreenFrame,
  type CustomerTab,
} from "./src/components/ui";

const [tab, setTab] = useState<CustomerTab>("home");
const [search, setSearch] = useState("");

<ScreenFrame>
  <AppHeader onHome={openHome} onNotifications={openNotifications} onBack={goBack} />
  <ScrollView keyboardShouldPersistTaps="handled">
    <SearchField label="Tìm kho" value={search} onChangeText={setSearch} onSubmit={findStorage} />
    <Button label="Tìm kho" onPress={() => findStorage(search.trim())} loading={pending} />
  </ScrollView>
  <BottomTabs selected={tab} onSelect={setTab} />
</ScreenFrame>
```

- `AppHeader`: logo, notification action, optional back action. Consumers supply callbacks.
- `BottomTabs`: **Trang chủ — Kho của tôi — Tài khoản** by default, with `home`, `rentals`, `profile` keys.
  `labels` optionally localizes the visible labels.
  Selection is controlled by the consumer. No routes or screens are changed automatically.
- `SearchField`: controlled text, search keyboard action, clear action, disabled state. `onSubmit`
  receives trimmed text; typing remains controlled by `onChangeText`, without built-in fetching
  or debounce. Clear keeps focus in the input.
- `IconButton`: labeled icon action with a minimum 44×44 target.
- `ListItem`: icon, label, optional description and chevron for profile/support menu actions.
- `Button`: primary, secondary, outline, ghost, danger and soft variants, disabled/loading states.
  `compact` preserves a 44px minimum target; `inline` omits the default bottom margin.
- Existing `Card`, `Field`, `Heading`, `Notice`, `Row`, `StatusPill`, `ChoiceTabs` and `CalendarField`
  remain available through the same entry point.
- `Card.compact` uses 16px padding for denser screens; default padding remains 20px.
  `outlined` omits the raised shadow; `flush` clips edge-to-edge media without padding.
- `SearchField.inverse` supports dark surfaces; `trailing` composes an inline submit action.
- `ActionLink` provides a 44px text/icon action. `SectionHeading` shares the section title and action layout.
- `StatusPill.compact` presents smaller status badges without changing default pills.
- `MobilePhoto.aspectRatio` sizes catalog images; `flush` removes its outer spacing.
- `ScreenFrame.className` sets a screen canvas including its safe-area padding.

Load `global.css` and the fonts from `src/theme/fonts.ts` at the app entry. Place `ScreenFrame`
inside `SafeAreaProvider`, once around the header, scrollable content and bottom tabs. Keyboard
avoidance belongs to the consuming screen.

`e2e/app-ui-fixture.tsx` is a standalone component preview used by Playwright.
Run `bun run --filter mobile test:e2e` to check
responsive layouts, interaction, accessibility, and the existing component suite.

Authentication screens in `src/screens/auth/` each have their own file and reuse this foundation.
`src/navigation/app-navigator.tsx` connects the feature hook directly to the active screen.
Shared type contracts and utility functions live in `src/common/`.

- `Button.leadingIcon` accepts a leading visual; loading replaces it with the spinner.
- `Field.labelAction` places an action or supporting content beside the label.
- `Field` with `secureTextEntry` includes a labeled show/hide control; its controlled value
  and `onChangeText` contract stay unchanged.

`src/features/auth/use-authentication.ts` coordinates React Hook Form/Zod validation and the
centralized auth/API clients. Previous screens are retained in `src/screens/old/` and are not
registered in `src/navigation/app-navigator.tsx`. API-mode customers use the three separate
home, appointments and appointment-detail screens through `customer-navigator.tsx`.
Their query/workflow hooks live in `src/features/customer-home/`. Staff and offline-demo
sessions retain `account-screen.tsx` until their new screens are implemented.

Customer flows without new native screens show a dismissible in-app notice. They never open web destinations.

`SearchField` keeps trailing controls fixed while its input uses the remaining width.
The core React Native `TextInput` receives NativeWind v5 styles directly.
`Button.trailingIcon` complements `leadingIcon`. Facility explorer cards reuse
`FacilityCard` with `variant="result"`; the home rail keeps its compact presentation.


The native booking flow is implemented in five `booking-*-screen.tsx` files. Its feature-local
`BookingFrame`, `BookingSummary`, `BookingCosts` and `UnitChoice` compose the foundation
above. `use-booking` owns the form and draft/appointment coordination, `use-booking-payment`
owns reconciliation, and `booking.service` owns recovery storage and appointment reuse.
Types and pure helpers stay in `common/booking.*`. SePay uses an embedded native WebView;
the `.web.tsx` variant provides the development preview without importing native WebView code.

`ChoiceTabs` keeps its default pill variant and optionally provides `variant="segmented"`
with count badges. `DetailSheet` composes the native Modal, safe-area frame, scrollable body
and labeled close action for record/transaction details.

The three **Kho của tôi** screens share `features/my-storage/components/StorageHeader`,
`RentalCard` and `TransactionRow`; `use-my-storage` owns complete cursor traversal, owner-scoped
queries and receipt/detail selection. Types and display helpers live in `common/my-storage.*`.
The transaction history represents payments attached to current and closed rentals.

`QueryFeedback.errorMessage` optionally supplies context-specific retry copy while retaining
its shared loading/error presentation. Storage partial-payment failures use this to keep the
incomplete-data warning beside the retry action.
