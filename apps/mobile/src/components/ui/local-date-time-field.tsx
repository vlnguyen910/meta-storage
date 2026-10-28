import { useState } from "react";
import { View } from "react-native";
import { CalendarField, facilityDay } from "./calendar-field";
import { DATE_TIME_UI as M } from "./local-date-time-field.messages";
import { Field } from "./mobile-ui";

export function LocalDateTimeField({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const initial = value && Number.isFinite(Date.parse(value)) ? new Date(value) : null;
  const [date, setDate] = useState(initial ? facilityDay(initial) : facilityDay());
  const [time, setTime] = useState(
    initial
      ? new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Ho_Chi_Minh",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(initial)
      : "",
  );
  const change = (nextDate: string, nextTime: string) =>
    onChange(`${nextDate}T${nextTime}:00+07:00`);
  return (
    <View>
      <CalendarField
        label={label}
        minDate="2020-01-01"
        value={date}
        disabled={disabled}
        onChange={(next) => {
          setDate(next);
          change(next, time);
        }}
      />
      <Field
        label={M.time}
        value={time}
        editable={!disabled}
        placeholder={M.placeholder}
        keyboardType="numbers-and-punctuation"
        maxLength={5}
        onChangeText={(next) => {
          setTime(next);
          change(date, next);
        }}
      />
    </View>
  );
}
