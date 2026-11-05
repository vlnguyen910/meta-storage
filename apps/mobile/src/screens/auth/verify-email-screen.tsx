import { Check, Mail } from "lucide-react-native";
import { Text, View } from "react-native";
import type { Authentication } from "../../common/auth.types";
import { Button, Icon, Notice } from "../../components/ui";
import { AUTHENTICATION as M } from "../../features/auth/authentication.messages";
import {
  AuthenticationLayout,
  AuthenticationSecurityNote,
  Brand,
  Feedback,
  Title,
} from "../../features/auth/components/authentication-layout";

export function VerifyEmailScreen({ auth }: { auth: Authentication }) {
  const returned = auth.verification === "returned";
  const expired = auth.verification === "expired";
  return (
    <AuthenticationLayout
      auth={auth}
      title={M.verifyPending}
      footer={<AuthenticationSecurityNote>{M.privacy}</AuthenticationSecurityNote>}
    >
      <View className="mb-6 items-center">
        <Brand />
        <View className="my-6 h-20 w-20 items-center justify-center rounded-card bg-primary-soft">
          <Icon as={returned ? Check : Mail} size={40} className="text-primary" />
        </View>
        <Title>{returned ? M.verifyReturned : expired ? M.verifyExpired : M.verifyPending}</Title>
        <Text className="mt-3 text-center font-body text-body leading-7 text-muted">
          {returned
            ? M.verifyReturnedDescription
            : expired
              ? M.verifyExpiredDescription
              : M.verifyDescription}
        </Text>
      </View>
      {auth.verificationEmail ? (
        <View className="mb-6 flex-row items-center gap-3 rounded-card border border-outline-variant bg-canvas p-4">
          <Icon as={Mail} className="text-muted" />
          <View className="min-w-0 flex-1 gap-1">
            <Text className="font-body text-label text-muted">{M.account}</Text>
            <Text className="font-body-semibold text-body text-ink">{auth.verificationEmail}</Text>
            {!returned ? (
              <Text className="font-body text-[12px] text-primary">{M.pending}</Text>
            ) : null}
          </View>
        </View>
      ) : !returned ? (
        <Notice>{M.missingVerificationEmail}</Notice>
      ) : null}
      <Feedback auth={auth} />
      <Button
        label={M.continueLogin}
        disabled={auth.pending}
        onPress={() => auth.navigate("login")}
      />
      {!returned && auth.verificationEmail ? (
        <Button
          label={auth.cooldown ? M.resendCountdown(auth.cooldown) : M.resend}
          variant="outline"
          loading={auth.pending}
          disabled={auth.cooldown > 0}
          onPress={auth.resend}
        />
      ) : null}
    </AuthenticationLayout>
  );
}
