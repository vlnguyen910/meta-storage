import { create } from "qrcode";
import { View } from "react-native";
import type { QrGridRow } from "./qr-grid.types";

export function BookingQr({ value, label }: { value: string; label: string }) {
  const matrix = create(value, { errorCorrectionLevel: "M" }).modules;
  const cell = 200 / (matrix.size + 8);
  const rows: QrGridRow[] = Array.from({ length: matrix.size }, (_, row) => ({
    id: `r${row}`,
    cells: Array.from({ length: matrix.size }, (_, column) => ({
      id: `r${row}c${column}`,
      filled: !!matrix.get(row, column),
    })),
  }));
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={label}
      className="mb-4 self-center bg-white"
      style={{ padding: 4 * cell }}
    >
      {rows.map((row) => (
        <View key={row.id} className="flex-row">
          {row.cells.map((pixel) => (
            <View
              key={pixel.id}
              style={{
                width: cell,
                height: cell,
                backgroundColor: pixel.filled ? "#000000" : "#ffffff",
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
