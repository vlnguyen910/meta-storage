import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { BackHandler, Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { ChoiceTabs } from "../../components/ui/choice-tabs";
import { MobilePhoto } from "../../components/ui/mobile-photo";
import { Button, Card, money, Row } from "../../components/ui/mobile-ui";
import { ScreenFrame } from "../../components/ui/screen-frame";
import type { CustomerRoute } from "../customer-api/customer-api.types";
import { CustomerCatalogScreen } from "../customer-api/customer-api-screens";
import { QueryNotice } from "../customer-api/query-notice";
import { MOBILE_LANDING as M } from "./landing.messages";
import { usePublicLanding } from "./use-public-landing";

const unitPhotos = [
  require("../../../assets/landing/4.png"),
  require("../../../assets/landing/5.png"),
  require("../../../assets/landing/6.png"),
  require("../../../assets/landing/7.png"),
];
const facilityPhotos = [
  require("../../../assets/landing/8.png"),
  require("../../../assets/landing/9.png"),
  require("../../../assets/landing/10.png"),
];
type PublicSection = "home" | "pricing" | "process" | "locations";

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <View className="mb-5">
      <Text className="mb-2 text-xs font-bold uppercase tracking-widest text-emerald-700">
        {eyebrow}
      </Text>
      <Text accessibilityRole="header" className="mb-3 text-2xl font-bold leading-8 text-slate-900">
        {title}
      </Text>
      {description ? (
        <Text className="text-base leading-6 text-slate-500">{description}</Text>
      ) : null}
    </View>
  );
}

export function PublicWorkspace({
  onLogin,
  onBook,
  signedIn,
}: {
  onLogin: () => void;
  onBook: (route: CustomerRoute) => void;
  signedIn: boolean;
}) {
  const state = usePublicLanding();
  const [page, setPage] = useState<"home" | "catalog">("home");
  const [menu, setMenu] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const positions = useRef<Partial<Record<PublicSection, number>>>({});
  const navigate = (section: PublicSection) => {
    setPage("home");
    setMenu(false);
    requestAnimationFrame(() =>
      scroll.current?.scrollTo({ y: positions.current[section] ?? 0, animated: true }),
    );
  };
  const catalog = () => {
    setPage("catalog");
    setMenu(false);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (menu) {
        setMenu(false);
        return true;
      }
      if (page === "catalog") {
        setPage("home");
        return true;
      }
      return false;
    });
    return () => handler.remove();
  }, [menu, page]);
  return (
    <ScreenFrame>
      <StatusBar style="dark" />
      <View className="border-b border-slate-200 bg-white px-4 py-3">
        <View className="mx-auto w-full max-w-5xl flex-row items-center gap-3">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={M.home}
            className="min-h-11 min-w-0 flex-1 flex-row items-center gap-2"
            onPress={() => navigate("home")}
          >
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-emerald-900">
              <Text className="text-2xl text-white">▥</Text>
            </View>
            <View className="min-w-0 flex-1">
              <Text numberOfLines={1} className="text-base font-bold text-emerald-900">
                {M.brand}
              </Text>
              <Text className="text-[10px] text-slate-500">{M.tagline}</Text>
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={signedIn ? M.account : M.login}
            onPress={onLogin}
            className="min-h-11 justify-center rounded-xl bg-emerald-900 px-3"
          >
            <Text className="text-sm font-semibold text-white">
              {signedIn ? M.account : M.login}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={M.menu}
            accessibilityState={{ expanded: menu }}
            onPress={() => setMenu(!menu)}
            className="min-h-11 min-w-11 items-center justify-center rounded-xl bg-slate-50"
          >
            <Text className="text-2xl text-emerald-900">☰</Text>
          </Pressable>
        </View>
        {menu && (
          <View className="mx-auto mt-4 w-full max-w-5xl gap-1">
            {[
              { label: M.home, value: "home" },
              { label: M.pricing, value: "pricing" },
              { label: M.process, value: "process" },
              { label: M.footerLocations, value: "locations" },
            ].map((link) => (
              <Button
                key={link.value}
                secondary
                label={link.label}
                onPress={() => navigate(link.value as PublicSection)}
              />
            ))}
            <Button secondary label={M.find} onPress={catalog} />
          </View>
        )}
      </View>
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerClassName="grow">
        {page === "catalog" ? (
          <View className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
            <Button secondary label={M.home} onPress={() => navigate("home")} />
            <CustomerCatalogScreen go={onBook} />
          </View>
        ) : (
          <View className="mx-auto w-full max-w-5xl px-4 sm:px-6">
            <View
              className="py-8"
              onLayout={(e) => {
                positions.current.home = e.nativeEvent.layout.y;
              }}
            >
              <Text className="mb-4 self-start rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold leading-5 text-emerald-800">
                {M.badge}
              </Text>
              <View className="gap-5 md:flex-row md:items-center">
                <View className="min-w-0 md:flex-1">
                  <Text
                    accessibilityRole="header"
                    className="mb-4 text-4xl font-bold leading-[44px] tracking-tight text-slate-900"
                  >
                    {M.heroTitle}
                  </Text>
                  <Text className="mb-6 text-base leading-7 text-slate-500">
                    {M.heroDescription}
                  </Text>
                  <Card>
                    <Text className="mb-3 text-sm font-semibold text-slate-800">{M.location}</Text>
                    <ChoiceTabs
                      options={state.facilityList.map((facility) => ({
                        value: facility.id,
                        label: facility.name,
                      }))}
                      value={state.facilityId}
                      onChange={state.setFacility}
                    />
                    <Text className="mb-3 text-sm font-semibold text-slate-800">{M.need}</Text>
                    <ChoiceTabs
                      options={[
                        { value: "all", label: M.allSizes },
                        { value: "small", label: M.personal },
                        { value: "large", label: M.large },
                      ]}
                      value={state.filter}
                      onChange={state.setFilter}
                    />
                    <Button
                      label={M.search}
                      disabled={!state.facilityId}
                      onPress={() => navigate("pricing")}
                    />
                  </Card>
                  <View className="mt-2 gap-2">
                    {M.searchHints.map((hint) => (
                      <Text key={hint} className="text-xs leading-5 text-emerald-800">
                        ✓ {hint}
                      </Text>
                    ))}
                  </View>
                </View>
                <View className="min-w-0 md:flex-1">
                  <MobilePhoto
                    tall
                    source={require("../../../assets/landing/2.png")}
                    label={M.imageAlt}
                  />
                  <Text className="text-center text-xs text-emerald-800">{M.lobby}</Text>
                </View>
              </View>
              <View className="mt-7 flex-row flex-wrap rounded-2xl border border-slate-200 bg-white p-2">
                {M.stats.map((stat) => (
                  <View key={stat.value} className="w-1/2 p-3 md:w-1/4">
                    <Text className="mb-2 text-2xl font-bold text-emerald-900">{stat.value}</Text>
                    <Text className="text-xs leading-5 text-slate-500">{stat.label}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View className="py-7">
              <SectionHeading
                eyebrow={M.whyEyebrow}
                title={M.whyTitle}
                description={M.whyDescription}
              />
              <View className="flex-row flex-wrap">
                {M.benefits.map((item, index) => (
                  <View key={item.title} className="w-full md:w-1/2 md:pr-4">
                    <Card>
                      <Text className="mb-3 text-2xl text-emerald-800">
                        {["◇", "❄", "↗", "▦"][index]}
                      </Text>
                      <Text className="mb-2 text-lg font-bold text-slate-900">{item.title}</Text>
                      <Text className="mb-3 text-sm leading-6 text-slate-500">
                        {item.description}
                      </Text>
                      <Text className="text-xs font-semibold text-emerald-800">{item.detail}</Text>
                    </Card>
                  </View>
                ))}
              </View>
            </View>
            <View
              className="py-7"
              onLayout={(e) => {
                positions.current.pricing = e.nativeEvent.layout.y;
              }}
            >
              <SectionHeading
                eyebrow={M.sizesEyebrow}
                title={M.sizesTitle}
                description={M.sizesDescription}
              />
              <Text className="mb-3 font-semibold text-slate-800">{M.location}</Text>
              <ChoiceTabs
                options={state.facilityList.map((f) => ({ value: f.id, label: f.name }))}
                value={state.facilityId}
                onChange={state.setFacility}
              />
              <QueryNotice query={state.facilities} />
              <ChoiceTabs
                options={[
                  { value: "all", label: M.allSizes },
                  { value: "small", label: M.personal },
                  { value: "large", label: M.large },
                ]}
                value={state.filter}
                onChange={state.setFilter}
              />
              {state.facilityId && <QueryNotice query={state.types} />}
              {state.types.isSuccess && !state.options.length && (
                <Card>
                  <Text>{M.noUnits}</Text>
                </Card>
              )}
              {state.options.map((unit, index) => (
                <Card key={unit.id}>
                  <MobilePhoto source={unitPhotos[index % unitPhotos.length]} label={M.imageAlt} />
                  <Text className="mb-2 text-xl font-bold text-slate-900">{unit.name}</Text>
                  <Row label={M.area} value={`${unit.lengthM * unit.widthM} m²`} />
                  <Row
                    label={M.dimensions}
                    value={`${unit.lengthM} × ${unit.widthM} × ${unit.heightM} m`}
                  />
                  <Text className="mt-3 text-xs text-slate-500">{M.priceLabel}</Text>
                  <Text className="my-2 text-2xl font-bold text-emerald-900">
                    {money(unit.monthlyPrice)}{" "}
                    <Text className="text-sm font-normal">{M.monthly}</Text>
                  </Text>
                  <Text className="mb-4 text-xs leading-5 text-slate-500">{M.unitDescription}</Text>
                  <Button
                    label={M.book}
                    onPress={() =>
                      onBook({
                        screen: "checkout",
                        facilityId: state.facilityId,
                        unitTypeId: unit.id,
                      })
                    }
                  />
                </Card>
              ))}
              {state.types.hasNextPage && (
                <Button
                  secondary
                  label={M.more}
                  disabled={state.types.isFetchingNextPage}
                  onPress={() => {
                    void state.types.fetchNextPage();
                  }}
                />
              )}
            </View>
            <View
              className="py-7"
              onLayout={(e) => {
                positions.current.process = e.nativeEvent.layout.y;
              }}
            >
              <SectionHeading
                eyebrow={M.processEyebrow}
                title={M.processTitle}
                description={M.processDescription}
              />
              {M.steps.map((step, index) => (
                <Card key={step.title}>
                  <Text className="mb-3 text-3xl font-bold text-emerald-700">
                    {String(index + 1).padStart(2, "0")}
                  </Text>
                  <Text className="mb-2 text-lg font-bold text-slate-900">{step.title}</Text>
                  <Text className="text-sm leading-6 text-slate-500">{step.description}</Text>
                </Card>
              ))}
            </View>
            <View
              className="py-7"
              onLayout={(e) => {
                positions.current.locations = e.nativeEvent.layout.y;
              }}
            >
              <SectionHeading
                eyebrow={M.networkEyebrow}
                title={M.networkTitle}
                description={M.networkDescription}
              />
              <QueryNotice query={state.facilities} />
              {state.facilityList.slice(0, 3).map((facility, index) => (
                <Card key={facility.id}>
                  <MobilePhoto source={facilityPhotos[index]} label={M.imageAlt} />
                  <Text className="mb-1 text-xs font-bold text-emerald-700">{facility.code}</Text>
                  <Text className="mb-3 text-xl font-bold text-slate-900">{facility.name}</Text>
                  <Text className="mb-4 text-sm leading-6 text-slate-500">{facility.address}</Text>
                  <Button
                    secondary
                    label={M.selectFacility}
                    onPress={() => {
                      state.setFacility(facility.id);
                      navigate("pricing");
                    }}
                  />
                </Card>
              ))}
              <Button secondary label={M.allFacilities} onPress={catalog} />
            </View>
            <View className="py-7">
              <SectionHeading eyebrow={M.reviewsEyebrow} title={M.reviewsTitle} />
              {M.stories.map((story) => (
                <Card key={story.name} title={story.name}>
                  <Text className="mb-2 text-xs font-semibold text-emerald-700">
                    {story.context}
                  </Text>
                  <Text className="text-sm leading-6 text-slate-500">{story.text}</Text>
                </Card>
              ))}
              <Card title={M.assuranceTitle}>
                {M.assurances.map((item) => (
                  <View key={item.title} className="mb-5">
                    <Text className="mb-2 font-bold text-slate-900">{item.title}</Text>
                    <Text className="text-sm leading-6 text-slate-500">{item.description}</Text>
                  </View>
                ))}
              </Card>
            </View>
            <View className="mb-8 rounded-3xl bg-emerald-900 p-6">
              <Text className="mb-3 text-xs font-semibold text-emerald-100">{M.finalEyebrow}</Text>
              <Text className="mb-4 text-2xl font-bold leading-8 text-white">{M.finalTitle}</Text>
              <Text className="mb-5 text-sm leading-6 text-emerald-100">{M.finalDescription}</Text>
              <Button secondary label={M.finalFind} onPress={catalog} />
              <Button
                secondary
                label={M.finalCall}
                onPress={() => {
                  void Linking.openURL("tel:19006868");
                }}
              />
            </View>
            <View className="border-t border-slate-200 py-6">
              <Text className="mb-3 text-xl font-bold text-emerald-900">{M.brand}</Text>
              <Text className="mb-5 text-sm leading-6 text-slate-500">{M.footerDescription}</Text>
              <Text className="mb-3 text-sm font-bold text-slate-800">{M.footerLinks}</Text>
              <Button secondary label={M.pricing} onPress={() => navigate("pricing")} />
              <Button secondary label={M.process} onPress={() => navigate("process")} />
              <Button secondary label={M.login} onPress={onLogin} />
              <Text className="mt-4 text-xs leading-5 text-slate-500">{M.copyright}</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </ScreenFrame>
  );
}
