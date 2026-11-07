import { ScrollView, Text, View } from "react-native";
import { ACCOUNT_MESSAGES as M } from "../../common/account.messages";
import { Button, Heading, Notice, ScreenFrame } from "../../components/ui";

export function AccountScreen({
  name,
  onLogout,
  pending,
  error,
}: {
  name: string;
  onLogout: () => void;
  pending: boolean;
  error?: string;
}) {
  return (
    <ScreenFrame>
      <ScrollView contentContainerClassName="grow justify-center bg-surface px-6 py-10">
        <View className="mx-auto w-full max-w-md">
          <Heading>{M.title}</Heading>
          <Text className="mb-3 font-body-semibold text-body leading-7 text-ink">{name}</Text>
          <Text className="mb-6 font-body text-body leading-7 text-muted">{M.description}</Text>
          {error ? <Notice error>{error}</Notice> : null}
          <Button label={M.logout} onPress={onLogout} loading={pending} />
        </View>
      </ScrollView>
    </ScreenFrame>
  );
}
