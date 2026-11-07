import { landingMessages } from "@/features/landing/landing.messages";
import { LandingScreen } from "@/features/landing/landing-screen";

export const metadata = {
  title: { absolute: landingMessages.pageTitle },
  description: landingMessages.heroDescription,
};

export default function HomePage() {
  return <LandingScreen />;
}
