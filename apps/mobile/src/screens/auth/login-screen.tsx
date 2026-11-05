import { Controller } from "react-hook-form";
import type { Authentication } from "../../common/auth.types";
import { Button, Field } from "../../components/ui";
import { AUTHENTICATION as M } from "../../features/auth/authentication.messages";
import {
  AuthenticationAccountFooter,
  AuthenticationHeader,
  AuthenticationLayout,
  Feedback,
  TextAction,
} from "../../features/auth/components/authentication-layout";
import { GoogleAuthButton } from "../../features/auth/components/google-auth-button";

export function LoginScreen({ auth }: { auth: Authentication }) {
  return (
    <AuthenticationLayout
      auth={auth}
      title={M.login}
      footer={<AuthenticationAccountFooter auth={auth} />}
    >
      <AuthenticationHeader title={M.login} />
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
      <GoogleAuthButton auth={auth} label={M.googleLogin} />
    </AuthenticationLayout>
  );
}
