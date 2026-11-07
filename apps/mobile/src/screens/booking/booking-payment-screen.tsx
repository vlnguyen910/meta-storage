import { Clock, Copy, X } from "lucide-react-native";
import { useState } from "react";
import { Image, Modal, Text, View } from "react-native";
import type { BookingScreenProps } from "../../common/booking.types";
import { paymentQrUrl } from "../../common/booking.utils";
import { Button, Card, Icon, IconButton, Notice, Row, ScreenFrame } from "../../components/ui";
import { money } from "../../components/ui/mobile-ui";
import { BOOKING as M } from "../../features/booking/booking.messages";
import { PaymentGateway } from "../../features/booking/components/payment-gateway";

export function BookingPaymentScreen({ state: s }: BookingScreenProps) {
  const [gateway, setGateway] = useState(false),
    [qrError, setQrError] = useState(false);
  const p = s.paymentState,
    info = p.query.data,
    instruction = info?.transferInstructions;
  const qr = paymentQrUrl(instruction);
  const url = info?.checkoutUrl ?? s.session?.checkoutUrl,
    fields = info?.checkoutFormFields ?? s.session?.checkoutFormFields;
  const pending = !p.status || p.status === "PENDING";
  const canPay = info?.status === "PENDING" && !p.expired;
  const terminal =
    p.status === "FAILED"
      ? M.failed
      : p.status === "REFUND_PENDING"
        ? M.refundPending
        : p.status === "REFUNDED"
          ? M.refunded
          : undefined;
  return (
    <>
      <Card compact outlined>
        <Text className="text-center font-body-medium text-[12px] text-muted">{M.code}</Text>
        <View className="flex-row items-center justify-center gap-2">
          <Text selectable className="shrink font-body-bold text-title text-primary">
            {s.payment?.paymentCode}
          </Text>
          <IconButton
            icon={Copy}
            label={`${M.copy}: ${M.code}`}
            onPress={() => void s.copy(s.payment?.paymentCode ?? "")}
          />
        </View>
        {pending ? (
          <View className="mb-2 flex-row items-center justify-center gap-2">
            <Icon as={Clock} size={16} className="text-warning-strong" />
            <Text
              accessibilityLiveRegion="none"
              className="font-body-semibold text-label text-warning-strong"
            >
              {Math.floor(p.seconds / 60)
                .toString()
                .padStart(2, "0")}
              :{(p.seconds % 60).toString().padStart(2, "0")}
            </Text>
          </View>
        ) : null}
        <Text className="text-center font-body text-label text-muted">{M.total}</Text>
        <Text className="mb-3 text-center font-body-bold text-[30px] leading-10 text-primary">
          {money(s.draft?.totalAmount ?? 0)}
        </Text>
        {canPay && qr ? (
          <>
            {qrError ? (
              <Notice error>{M.qrError}</Notice>
            ) : (
              <Image
                accessibilityLabel={M.paymentQr}
                source={{ uri: qr }}
                onError={() => setQrError(true)}
                className="mb-3 h-[224px] w-[224px] self-center bg-white"
                resizeMode="contain"
              />
            )}
            <Text className="mb-3 text-center font-body text-label leading-6 text-muted">
              {M.qrHint}
            </Text>
            <Row label={M.bank} value={instruction?.bankName ?? "—"} />
            <Row label={M.bankAccount} value={instruction?.accountNumber ?? "—"} />
            <Row label={M.bankHolder} value={instruction?.accountName ?? "—"} />
            <Row label={M.transferContent} value={instruction?.content ?? "—"} />
            <Button
              label={M.copyAmount}
              variant="outline"
              onPress={() => void s.copy(instruction?.amount ?? "")}
              compact
            />
            <Button
              label={`${M.copy}: ${M.transferContent}`}
              variant="outline"
              onPress={() => void s.copy(instruction?.content ?? "")}
              compact
            />
          </>
        ) : null}
        {canPay && url && fields ? (
          <Button label={M.gateway} onPress={() => setGateway(true)} />
        ) : null}
        <Text className="mt-2 text-center font-body text-[12px] text-muted">{M.provider}</Text>
      </Card>
      {terminal ? (
        <Notice error>{terminal}</Notice>
      ) : p.expired && pending ? (
        <Notice error>{M.expired}</Notice>
      ) : (
        <Notice>{pending ? M.waiting : M.paymentHint}</Notice>
      )}
      {p.query.isError || p.receipt.isError ? <Notice error>{M.network}</Notice> : null}
      <Button
        label={M.checkPayment}
        variant="outline"
        loading={p.query.isFetching || p.receipt.isFetching}
        onPress={() => void p.refresh()}
      />
      <Text className="mb-4 text-center font-body text-[12px] leading-5 text-muted">
        {M.pendingHint}
      </Text>
      {p.status === "FAILED" ? (
        <Button label={M.restart} onPress={() => void s.restart()} loading={s.busy} />
      ) : null}
      <Modal
        visible={gateway && canPay}
        animationType="slide"
        onRequestClose={() => {
          setGateway(false);
          void p.refresh();
        }}
      >
        <ScreenFrame className="bg-customer-canvas">
          <View className="flex-row items-center justify-between px-4 py-2">
            <Text
              accessibilityRole="header"
              className="flex-1 font-body-bold text-body text-primary"
            >
              {M.gatewayTitle}
            </Text>
            <IconButton
              icon={X}
              label={M.close}
              onPress={() => {
                setGateway(false);
                void p.refresh();
              }}
            />
          </View>
          {url && fields ? (
            <PaymentGateway
              url={url}
              fields={fields}
              onReturn={() => {
                setGateway(false);
                void p.refresh();
              }}
              onCheck={() => void p.refresh()}
              onError={() => {
                setGateway(false);
                s.reportGatewayError();
              }}
            />
          ) : null}
        </ScreenFrame>
      </Modal>
    </>
  );
}
