import { Controller } from "react-hook-form";
import { Text } from "react-native";
import type { Authentication } from "../../common/auth.types";
import { Button, Field } from "../../components/ui";
import { AUTHENTICATION as M } from "../../features/auth/authentication.messages";
import {
  AuthenticationAccountFooter,
  AuthenticationHeader,
  AuthenticationLayout,
  AuthenticationSecurityNote,
  Feedback,
} from "../../features/auth/components/authentication-layout";
import { GoogleAuthButton } from "../../features/auth/components/google-auth-button";

export function RegisterScreen({ auth }: { auth: Authentication }) {
  const fields = [
    { name: "email", label: `${M.email} *`, placeholder: M.emailPlaceholder },
    { name: "password", label: `${M.password} *`, placeholder: M.newPasswordPlaceholder },
    { name: "name", label: `${M.name} *`, placeholder: M.namePlaceholder },
    { name: "phone", label: M.phone, placeholder: M.phonePlaceholder },
  ] as const;
  return (
    <AuthenticationLayout
      auth={auth}
      title={M.registerTitle}
      compact
      footer={
        <>
          <AuthenticationAccountFooter auth={auth} />
          <AuthenticationSecurityNote>{M.privacy}</AuthenticationSecurityNote>
        </>
      }
    >
      <AuthenticationHeader title={M.registerTitle} compact />
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
      <GoogleAuthButton auth={auth} label={M.googleRegister} />
    </AuthenticationLayout>
  );
}
