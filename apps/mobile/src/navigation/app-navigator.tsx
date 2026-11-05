import { View } from "react-native";
import type { AppSession, AuthenticationOptions } from "../common/auth.types";
import { Button, Notice, ScreenFrame } from "../components/ui";
import { ThemedActivityIndicator } from "../components/ui/native-styles";
import { AUTHENTICATION as M } from "../features/auth/authentication.messages";
import { useAppSession, useDemoSession } from "../features/auth/use-app-session";
import { useAuthentication } from "../features/auth/use-authentication";
import { AccountScreen } from "../screens/account-screen";
import { ForgotPasswordScreen } from "../screens/auth/forgot-password-screen";
import { LoginScreen } from "../screens/auth/login-screen";
import { RegisterScreen } from "../screens/auth/register-screen";
import { VerifyEmailScreen } from "../screens/auth/verify-email-screen";
import { CustomerNavigator } from "./customer-navigator";

export function AppNavigator() {
  const session = useAppSession();
  return <SessionRoutes session={session} />;
}

export function DemoNavigator() {
  const session = useDemoSession();
  return <SessionRoutes session={session} demo />;
}

function SessionRoutes({ session, demo = false }: { session: AppSession; demo?: boolean }) {
  if (session.pending || session.error) {
    return (
      <ScreenFrame>
        <View className="flex-1 justify-center bg-surface p-6">
          {session.pending ? (
            <ThemedActivityIndicator accessibilityLabel={M.loading} className="text-primary" />
          ) : (
            <>
              <Notice error>{M.networkError}</Notice>
              <Button label={M.retry} onPress={session.refresh} />
            </>
          )}
        </View>
      </ScreenFrame>
    );
  }
  return session.user && !demo && "role" in session.user && session.user.role === "CUSTOMER" ? (
    <CustomerNavigator
      key={session.user.id}
      user={session.user}
      onLogout={session.signOut}
      pending={session.signingOut}
      error={session.signOutError}
    />
  ) : session.user ? (
    <AccountScreen
      name={session.user.name}
      onLogout={session.signOut}
      pending={session.signingOut}
      error={session.signOutError}
    />
  ) : (
    <AuthNavigator callbackUrl={session.callbackUrl} demo={demo} />
  );
}

export function AuthNavigator(options: AuthenticationOptions) {
  const auth = useAuthentication(options);
  switch (auth.page) {
    case "login":
      return <LoginScreen auth={auth} />;
    case "register":
      return <RegisterScreen auth={auth} />;
    case "forgot-password":
      return <ForgotPasswordScreen auth={auth} />;
    case "verify-email":
      return <VerifyEmailScreen auth={auth} />;
  }
}
