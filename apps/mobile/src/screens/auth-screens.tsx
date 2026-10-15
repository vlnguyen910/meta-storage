import { Controller } from "react-hook-form";
import { Text, View } from "react-native";
import { Button, Card, Field, Heading, Notice } from "../components/ui/mobile-ui";
import { MOBILE_AUTH_MESSAGES as m } from "../features/mobile-auth/mobile-auth.messages";
import { useMobileAuth } from "../features/mobile-auth/use-mobile-auth";
import type { MobileScreenProps } from "./mobile-screen.types";

export function AuthScreens(props: MobileScreenProps) {
  const auth = useMobileAuth(props);
  const { route, go, pending } = props;
  if (route.screen === "M-A03")
    return (
      <>
        <Heading>{m.verify}</Heading>
        <Card>
          <Text className="mb-4 font-semibold text-[#125345]">{auth.email}</Text>
          <Notice>{m.verifyHint}</Notice>
          <Button label={m.verify} disabled={pending} onPress={() => void auth.verify()} />
          <Button label={m.returnLogin} secondary onPress={() => go("M-A01")} />
        </Card>
      </>
    );
  if (route.screen === "M-A04")
    return (
      <>
        <Heading>{m.recover}</Heading>
        <Card>
          <Field
            label={m.email}
            value={auth.email}
            onChangeText={auth.setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            error={auth.emailError}
          />
          {auth.sent ? <Notice>{m.sent}</Notice> : null}
          <Button
            label={m.send}
            disabled={pending || auth.cooldown > 0}
            hint={auth.cooldown ? m.cooldown(auth.cooldown) : undefined}
            onPress={() => void auth.recover()}
          />
          <Button label={m.returnLogin} secondary onPress={() => go("M-A01")} />
        </Card>
      </>
    );
  if (route.screen === "M-A02")
    return (
      <>
        <Heading>{m.register}</Heading>
        <Card>
          {(["name", "phone", "email", "password", "confirmPassword"] as const).map((name) => (
            <Controller
              key={name}
              name={name}
              control={auth.signup.control}
              render={({ field, fieldState }) => (
                <Field
                  ref={field.ref}
                  label={m[name === "confirmPassword" ? "confirm" : name]}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  secureTextEntry={name.includes("assword")}
                  autoCapitalize={name === "name" ? "words" : "none"}
                  keyboardType={
                    name === "email" ? "email-address" : name === "phone" ? "phone-pad" : "default"
                  }
                  error={fieldState.error?.message}
                  hint={
                    name === "password"
                      ? m.passwordHint
                      : name === "phone"
                        ? m.phoneHint
                        : undefined
                  }
                />
              )}
            />
          ))}
          <Button label={m.register} disabled={pending} onPress={() => void auth.register()} />
          <Button label={m.returnLogin} secondary onPress={() => go("M-A01")} />
        </Card>
      </>
    );
  return (
    <View>
      <Heading>{m.login}</Heading>
      <Card>
        {(["email", "password"] as const).map((name) => (
          <Controller
            key={name}
            name={name}
            control={auth.login.control}
            render={({ field, fieldState }) => (
              <Field
                ref={field.ref}
                label={m[name]}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                secureTextEntry={name === "password"}
                autoCapitalize="none"
                keyboardType={name === "email" ? "email-address" : "default"}
                error={fieldState.error?.message}
              />
            )}
          />
        ))}
        <Button label={m.login} disabled={pending} onPress={() => void auth.signIn()} />
        <Button label={m.forgot} secondary onPress={() => go("M-A04")} />
      </Card>
      <Card title={m.demos}>
        {auth.confirmReset ? (
          <>
            <Notice>{m.resetHint}</Notice>
            <Button
              label={m.resetConfirm}
              danger
              disabled={pending}
              onPress={() => void auth.reset()}
            />
            <Button label={m.resetCancel} secondary onPress={() => auth.setConfirmReset(false)} />
          </>
        ) : (
          <Button
            label={m.reset}
            secondary
            disabled={pending}
            onPress={() => auth.setConfirmReset(true)}
          />
        )}
        <Text className="mb-3 text-[#52635A]">{m.demoPassword}</Text>
        <Button label={m.customer} secondary onPress={() => auth.demo("customer")} />
        <Button label={m.staff} secondary onPress={() => auth.demo("staff")} />
      </Card>
      <Button label={m.signup} secondary onPress={() => go("M-A02")} />
      <Button label={m.guest} secondary onPress={() => go("M-P01")} />
    </View>
  );
}
