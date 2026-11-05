import { ArrowLeft, KeyRound } from "lucide-react-native";
import { Controller } from "react-hook-form";
import { Text, View } from "react-native";
import type { Authentication } from "../../common/auth.types";
import { Button, Field, Icon } from "../../components/ui";
import { AUTHENTICATION as M } from "../../features/auth/authentication.messages";
import {
  AuthenticationLayout,
  AuthenticationSecurityNote,
  Brand,
  Feedback,
  Title,
} from "../../features/auth/components/authentication-layout";

export function ForgotPasswordScreen({ auth }: { auth: Authentication }) {
  return (
    <AuthenticationLayout
      auth={auth}
      title={M.forgotTitle}
      onBack={() => auth.navigate("login")}
      footer={<AuthenticationSecurityNote>{M.recoveryValidity}</AuthenticationSecurityNote>}
    >
      <View className="mb-7 items-center">
        <Brand />
        <View className="my-4 h-14 w-14 items-center justify-center rounded-card bg-primary-soft">
          <Icon as={KeyRound} size={28} className="text-primary" />
        </View>
        <Title>{M.forgotTitle}</Title>
        <Text className="mt-3 text-center font-body text-label leading-6 text-muted">
          {M.forgotDescription}
        </Text>
      </View>
      <Controller
        control={auth.recovery.control}
        name="email"
        render={({ field, fieldState }) => (
          <Field
            label={M.linkedEmail}
            placeholder={M.emailPlaceholder}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            ref={field.ref}
            error={fieldState.error?.message}
            editable={!auth.pending}
            returnKeyType="send"
            onSubmitEditing={() => {
              if (!auth.cooldown) void auth.recover();
            }}
          />
        )}
      />
      <Feedback auth={auth} />
      <Button
        label={M.sendRecovery}
        hint={auth.cooldown ? M.resendCountdown(auth.cooldown) : undefined}
        loading={auth.pending}
        disabled={auth.cooldown > 0}
        onPress={() => void auth.recover()}
      />
      <View className="mt-3">
        <Button
          label={M.backToLogin}
          variant="ghost"
          leadingIcon={<Icon as={ArrowLeft} className="text-muted" />}
          disabled={auth.pending}
          onPress={() => auth.navigate("login")}
        />
      </View>
    </AuthenticationLayout>
  );
}
