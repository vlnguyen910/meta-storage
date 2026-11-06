import { useState } from "react";
import { Image, type ImageSourcePropType, View } from "react-native";

export function MobilePhoto({
  source,
  label,
  tall = false,
  aspectRatio,
  flush = false,
}: {
  source: ImageSourcePropType;
  label: string;
  tall?: boolean;
  aspectRatio?: number;
  flush?: boolean;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  return (
    <View
      className={`w-full overflow-hidden ${flush ? "" : "mb-4 rounded-[4px]"} ${aspectRatio ? "" : tall ? "h-48" : "h-44"}`}
      style={aspectRatio ? { aspectRatio } : undefined}
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
