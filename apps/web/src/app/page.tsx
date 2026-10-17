import { landingMessages } from "@/features/landing/landing.messages";
import { LandingScreen } from "@/features/landing/landing-screen";

export const metadata = {
  title: landingMessages.pageTitle,
  description: landingMessages.heroDescription,
};

export default function HomePage() {
  return <LandingScreen />;
}
