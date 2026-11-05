# Mobile components

Import the UI foundation from `src/components/ui`. Components use the existing mobile tokens,
fonts and Lucide icons. They do not fetch data, navigate, or manage sessions.
`AppHeader` uses `assets/logo/logo.png` with the app wordmark.

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
- `BottomTabs`: exactly **Home — Kho của tôi — Profile**, with `home`, `rentals`, `profile` keys.
  Selection is controlled by the consumer. No routes or screens are changed automatically.
- `SearchField`: controlled text, search keyboard action, clear action, disabled state. `onSubmit`
  receives trimmed text; typing remains controlled by `onChangeText`, without built-in fetching
  or debounce. Clear keeps focus in the input.
- `IconButton`: labeled icon action with a minimum 44×44 target.
- `ListItem`: icon, label, optional description and chevron for profile/support menu actions.
- `Button`: primary, secondary, outline, ghost and danger variants, disabled/loading states.
- Existing `Card`, `Field`, `Heading`, `Notice`, `Row`, `StatusPill`, `ChoiceTabs` and `CalendarField`
  remain available through the same entry point.

Load `global.css` and the fonts from `src/theme/fonts.ts` at the app entry. Place `ScreenFrame`
inside `SafeAreaProvider`, once around the header, scrollable content and bottom tabs. Keyboard
avoidance belongs to the consuming screen.

The new components are not mounted into existing product screens. `e2e/app-ui-fixture.tsx` is a
standalone component preview used by Playwright. Run `bun run --filter mobile test:e2e` to check
responsive layouts, interaction, accessibility, and the existing component suite.

Authentication screens reuse this foundation in `src/screens/authentication-screen.tsx`.

- `Button.leadingIcon` accepts a leading visual; loading replaces it with the spinner.
- `Field.labelAction` places an action or supporting content beside the label.
- `Field` with `secureTextEntry` includes a labeled show/hide control; its controlled value
  and `onChangeText` contract stay unchanged.

`src/features/auth/use-authentication.ts` coordinates React Hook Form/Zod validation and the
centralized auth/API clients. The previous authentication screens are intentionally retained.
