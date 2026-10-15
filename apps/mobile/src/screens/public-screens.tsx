import { Text, View } from "react-native";
import { MobilePhoto } from "../components/ui/mobile-photo";
import { Button, Card, Field, Heading, money, Notice, Row } from "../components/ui/mobile-ui";
import { DEMO_MESSAGES } from "../features/demo/demo.messages";
import { PUBLIC_MESSAGES as m } from "../features/public/public.messages";
import { usePublicCatalog } from "../features/public/use-public-catalog";
import type { MobileScreenProps } from "./mobile-screen.types";

export function PublicScreens({ route, data, go }: MobileScreenProps) {
  const catalog = usePublicCatalog(data);
  const facility = data.facilities.find((f) => f.id === route.id);
  if (route.screen === "M-P02" && !facility) return <Notice error>{DEMO_MESSAGES.missing}</Notice>;
  return (
    <View>
      {route.screen === "M-P00" ? (
        <>
          <Heading>{m.hero}</Heading>
          <Text className="mb-4 text-base leading-6 text-[#52635A]">{m.intro}</Text>
          <MobilePhoto
            label={m.illustration}
            source={require("../../assets/stitch/storage-interior.png")}
          />
          <Button label={m.find} onPress={() => go("M-P01")} />
          <Card title={m.flow}>
            {[m.step1, m.step2, m.step3].map((step) => (
              <Text key={step} className="mb-3 leading-6 text-[#131B2E]">
                {step}
              </Text>
            ))}
          </Card>
        </>
      ) : null}
      {route.screen === "M-P01" ? (
        <>
          <Heading>{m.find}</Heading>
          <Field label={m.search} value={catalog.search} onChangeText={catalog.setSearch} />
          <View className="mb-3 flex-row flex-wrap gap-2">
            {["", "TP. Hồ Chí Minh", "Hà Nội", "Đà Nẵng"].map((city) => (
              <Button
                key={city}
                label={city || m.all}
                secondary={catalog.city !== city}
                onPress={() => catalog.setCity(city)}
              />
            ))}
          </View>
          <Button label={m.reset} secondary onPress={catalog.reset} />
        </>
      ) : null}
      {route.screen !== "M-P02"
        ? catalog.facilities.map((f) => (
            <Card key={f.id} title={f.name}>
              <Text className="mb-3 leading-5 text-[#52635A]">{f.address}</Text>
              <Row label={m.price} value={`${money(f.startingMonthlyPrice)} ${m.months}`} />
              <Notice>{f.availableUnits ? m.availability(f.availableUnits) : m.soldOut}</Notice>
              <Button label={m.detail} onPress={() => go("M-P02", f.id)} />
            </Card>
          ))
        : null}
      {!catalog.facilities.length ? <Notice>{m.empty}</Notice> : null}
      {facility && route.screen === "M-P02" ? (
        <>
          <Heading>{facility.name}</Heading>
          <MobilePhoto
            label={m.illustration}
            source={require("../../assets/stitch/storage-interior.png")}
            tall
          />
          <Card title={m.branches}>
            <Row label={m.address} value={facility.address} />
            <Notice>{m.scope}</Notice>
          </Card>
          <Heading>{m.sizes}</Heading>
          {data.unitTypes
            .filter((t) => t.facilityId === facility.id)
            .map((type) => (
              <Card key={type.unitTypeId} title={`${type.unitType} • ${type.sizeLabel}`}>
                <Row label={m.price} value={`${money(type.monthlyPrice)} ${m.months}`} />
                <Notice>
                  {type.availableCount ? m.availability(type.availableCount) : m.soldOut}
                </Notice>
                <Button
                  label={m.choose}
                  disabled={!type.availableCount}
                  hint={!type.availableCount ? m.soldOut : undefined}
                  onPress={() => go("M-CK01", facility.id)}
                />
              </Card>
            ))}
        </>
      ) : null}
    </View>
  );
}
