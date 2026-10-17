import { useState } from "react";
import { Image, type ImageSourcePropType, View } from "react-native";

export function MobilePhoto({
  source,
  label,
  tall = false,
}: {
  source: ImageSourcePropType;
  label: string;
  tall?: boolean;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  return (
    <View
      className={`mb-4 w-full overflow-hidden rounded-[4px] ${tall ? "h-48" : "h-44"}`}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setSize((current) =>
          current.width === width && current.height === height ? current : { width, height },
        );
      }}
    >
      <Image
        accessibilityLabel={label}
        source={source}
        resizeMode="cover"
        style={{ width: size.width, height: size.height }}
      />
    </View>
  );
}
