import { CustomerSignUpInputSchema } from "@metastorage/contracts";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import type { CustomerNavigatorProps } from "../../common/customer-home.types";
import { PROFILE as M } from "../../common/profile.messages";
import { authClient } from "../../lib/auth-client";

export function useProfileEditor(user: CustomerNavigatorProps["user"]) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [validation, setValidation] = useState<{ name?: string; phone?: string }>({});
  const save = useMutation({
    mutationFn: async (values: { name: string; phone: string }) => {
      const result = await authClient.updateUser(values);
      if (result.error) throw new Error(M.saveError);
    },
    onSuccess: () => setEditing(false),
  });
  function submit() {
    if (save.isPending) return;
    if (!editing) {
      setName(user.name);
      setPhone(user.phone ?? "");
      setValidation({});
      save.reset();
      setEditing(true);
      return;
    }
    const parsedName = CustomerSignUpInputSchema.shape.name.safeParse(name);
    const parsedPhone = CustomerSignUpInputSchema.shape.phone.safeParse(phone.trim() || undefined);
    setValidation({
      name: parsedName.success ? undefined : M.nameError,
      phone: parsedPhone.success ? undefined : M.phoneError,
    });
    if (parsedName.success && parsedPhone.success) {
      save.mutate({ name: parsedName.data, phone: parsedPhone.data ?? "" });
    }
  }
  return { editing, name, phone, setName, setPhone, validation, save, submit };
}
