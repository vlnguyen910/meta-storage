import { CameraView, useCameraPermissions } from "expo-camera";
import { useEffect, useRef, useState } from "react";
import { Modal, Text, View } from "react-native";
import { Button, Notice } from "../../components/ui/mobile-ui";
import { STAFF_MESSAGES as m } from "./staff.messages";

export function StaffCamera({
  mode,
  onResult,
  onClose,
}: {
  mode: "scan" | "photo" | null;
  onResult: (result: string) => void;
  onClose: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const scanned = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (mode) scanned.current = false;
  }, [mode]);
  const close = () => {
    scanned.current = false;
    setError(null);
    onClose();
  };
  const take = async () => {
    setBusy(true);
    try {
      const photo = await camera.current?.takePictureAsync({ quality: 0.1, base64: true });
      if (photo?.base64) onResult(`data:image/jpeg;base64,${photo.base64}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : m.permission);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal visible={!!mode} animationType="slide" onRequestClose={close}>
      <View className="flex-1 bg-[#F6F8F6] p-5 pt-12">
        {error ? <Notice error>{error}</Notice> : null}
        {permission?.granted && mode ? (
          <CameraView
            ref={camera}
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={
              mode === "scan"
                ? (event) => {
                    if (!scanned.current) {
                      scanned.current = true;
                      onResult(event.data);
                    }
                  }
                : undefined
            }
          />
        ) : (
          <>
            <Text className="mb-5 text-base leading-6 text-[#131B2E]">{m.permission}</Text>
            <Button
              label={m.allow}
              onPress={() => {
                scanned.current = false;
                void requestPermission();
              }}
            />
          </>
        )}
        {permission?.granted && mode === "photo" ? (
          <Button label={m.take} disabled={busy} onPress={() => void take()} />
        ) : null}
        <Button label={m.closeCamera} secondary disabled={busy} onPress={close} />
      </View>
    </Modal>
  );
}
