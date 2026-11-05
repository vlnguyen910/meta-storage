import { ArrowLeft, Check, KeyRound, Mail, ShieldCheck } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { Controller } from "react-hook-form";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { Button, Field, Icon, IconButton, Notice, ScreenFrame } from "../components/ui";
import { AUTHENTICATION as M } from "../features/auth/authentication.messages";
import { type AuthenticationOptions, useAuthentication } from "../features/auth/use-authentication";

type Authentication = ReturnType<typeof useAuthentication>;

export function AuthenticationScreen(options: AuthenticationOptions) {
  const auth = useAuthentication(options);
  const scroll = useRef<ScrollView>(null);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
    if (Platform.OS === "web") {
      document.title = `${auth.page === "register" ? M.registerTitle : auth.page === "forgot-password" ? M.forgotTitle : auth.page === "verify-email" ? M.verifyPending : M.login} | ${M.brand}`;
    }
  }, [auth.page]);
  const compact = auth.page === "register";
  return (
    <ScreenFrame>
      <KeyboardAvoidingView
        className="flex-1 bg-surface"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerClassName="grow"
        >
          <View className="flex-1">
            {auth.page === "forgot-password" ? (
              <View className="flex-row px-4 pt-2">
                <IconButton
                  icon={ArrowLeft}
                  label={M.back}
                  onPress={() => auth.navigate("login")}
                  disabled={auth.pending}
                />
              </View>
            ) : null}
            <View
              role={Platform.OS === "web" ? "main" : undefined}
              className={`flex-1 justify-center px-6 ${compact ? "py-6" : "py-10"}`}
            >
              <View className="mx-auto w-full max-w-md">
                {auth.page === "login" || compact ? (
                  <>
                    <View className={`items-center ${compact ? "mb-6" : "mb-10"}`}>
                      <Brand />
                      <Title>{compact ? M.registerTitle : M.login}</Title>
                    </View>
                    {compact ? <Registration auth={auth} /> : <Login auth={auth} />}
                    <View className="my-3 flex-row items-center gap-3">
                      <View className="h-px flex-1 bg-outline-variant" />
                      <Text className="font-body text-label text-muted">{M.or}</Text>
                      <View className="h-px flex-1 bg-outline-variant" />
                    </View>
                    <Button
                      label={compact ? M.googleRegister : M.googleLogin}
                      variant="outline"
                      leadingIcon={<GoogleIcon />}
                      disabled={auth.pending}
                      onPress={auth.google}
                    />
                  </>
                ) : auth.page === "forgot-password" ? (
                  <Recovery auth={auth} />
                ) : (
                  <Verification auth={auth} />
                )}
              </View>
            </View>
            <View className="border-t border-line bg-canvas px-6 py-4">
              <View className="mx-auto w-full max-w-md items-center gap-2">
                {auth.page === "login" || compact ? (
                  <View className="flex-row flex-wrap items-center justify-center gap-x-2">
                    <Text className="font-body text-label text-muted">
                      {compact ? M.hasAccount : M.noAccount}
                    </Text>
                    <TextAction
                      label={compact ? M.login : M.registerNow}
                      disabled={auth.pending}
                      onPress={() => auth.navigate(compact ? "login" : "register")}
                    />
                  </View>
                ) : null}
                {auth.page !== "login" ? (
                  <View className="flex-row items-center justify-center gap-2">
                    <Icon as={ShieldCheck} size={16} className="text-primary" />
                    <Text className="shrink text-center font-body text-[12px] leading-5 text-muted">
                      {auth.page === "forgot-password" ? M.recoveryValidity : M.privacy}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenFrame>
  );
}

function Login({ auth }: { auth: Authentication }) {
  return (
    <>
      <Controller
        control={auth.login.control}
        name="email"
        render={({ field, fieldState }) => (
          <Field
            label={M.email}
            placeholder={M.emailPlaceholder}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            ref={field.ref}
            error={fieldState.error?.message}
            editable={!auth.pending}
            returnKeyType="next"
            onSubmitEditing={() => auth.login.setFocus("password")}
          />
        )}
      />
      <Controller
        control={auth.login.control}
        name="password"
        render={({ field, fieldState }) => (
          <Field
            label={M.password}
            placeholder={M.passwordPlaceholder}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            textContentType="password"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            ref={field.ref}
            error={fieldState.error?.message}
            editable={!auth.pending}
            returnKeyType="go"
            onSubmitEditing={() => void auth.signIn()}
            labelAction={
              <TextAction
                label={M.forgotTitle}
                disabled={auth.pending}
                onPress={() => auth.navigate("forgot-password")}
              />
            }
          />
        )}
      />
      <Feedback auth={auth} />
      <Button label={M.login} loading={auth.pending} onPress={() => void auth.signIn()} />
    </>
  );
}

function Registration({ auth }: { auth: Authentication }) {
  const fields = [
    { name: "email", label: `${M.email} *`, placeholder: M.emailPlaceholder },
    { name: "password", label: `${M.password} *`, placeholder: M.newPasswordPlaceholder },
    { name: "name", label: `${M.name} *`, placeholder: M.namePlaceholder },
    { name: "phone", label: M.phone, placeholder: M.phonePlaceholder },
  ] as const;
  return (
    <>
      {fields.map((item, index) => (
        <Controller
          key={item.name}
          control={auth.registration.control}
          name={item.name}
          render={({ field, fieldState }) => (
            <Field
              label={item.label}
              placeholder={item.placeholder}
              value={field.value ?? ""}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              ref={field.ref}
              error={fieldState.error?.message}
              editable={!auth.pending}
              secureTextEntry={item.name === "password"}
              autoCorrect={false}
              autoCapitalize={item.name === "name" ? "words" : "none"}
              keyboardType={
                item.name === "email"
                  ? "email-address"
                  : item.name === "phone"
                    ? "phone-pad"
                    : "default"
              }
              autoComplete={
                item.name === "password"
                  ? "new-password"
                  : item.name === "phone"
                    ? "tel"
                    : item.name
              }
              returnKeyType={index === fields.length - 1 ? "go" : "next"}
              onSubmitEditing={() =>
                index === fields.length - 1
                  ? void auth.register()
                  : auth.registration.setFocus(fields[index + 1].name)
              }
              labelAction={
                item.name === "phone" ? (
                  <Text className="font-body text-[12px] text-muted">{M.optional}</Text>
                ) : undefined
              }
            />
          )}
        />
      ))}
      <Feedback auth={auth} />
      <Button label={M.register} loading={auth.pending} onPress={() => void auth.register()} />
    </>
  );
}

function Recovery({ auth }: { auth: Authentication }) {
  return (
    <>
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
    </>
  );
}

function Verification({ auth }: { auth: Authentication }) {
  const returned = auth.verification === "returned";
  const expired = auth.verification === "expired";
  return (
    <>
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
    </>
  );
}

function Brand() {
  return (
    <View className="items-center gap-1">
      <Image
        source={require("../../assets/logo/logo.png")}
        accessible={false}
        resizeMode="contain"
        className="h-[48px] w-[68px] web:h-[48px]! web:w-[68px]!"
      />
      <Text className="font-body-bold text-[12px] tracking-[2px] text-primary">
        {M.brand.toUpperCase()}
      </Text>
    </View>
  );
}
function Title({ children }: { children: string }) {
  return (
    <Text
      accessibilityRole="header"
      aria-level={Platform.OS === "web" ? 1 : undefined}
      className="mt-4 text-center font-body-bold text-title leading-9 text-ink"
    >
      {children}
    </Text>
  );
}
function TextAction({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-touch justify-center rounded-control px-1 web:focus-visible:outline-2 web:focus-visible:outline-ring ${disabled ? "opacity-55" : ""}`}
    >
      <Text className="font-body-semibold text-label text-primary">{label}</Text>
    </Pressable>
  );
}
function Feedback({ auth }: { auth: Authentication }) {
  return auth.error ? (
    <Notice error>{auth.error}</Notice>
  ) : auth.feedback ? (
    <Notice>{auth.feedback}</Notice>
  ) : null;
}
function GoogleIcon() {
  // Same provider mark used by the web sign-in button.
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" aria-hidden={true}>
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </Svg>
  );
}
