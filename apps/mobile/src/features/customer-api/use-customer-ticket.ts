import { zodResolver } from "@hookform/resolvers/zod";
import {
  SUPPORT_IMAGE_MAX_BYTES,
  type SupportImageInput,
  type SupportReplyInput,
  SupportReplyInputSchema,
} from "@metastorage/contracts";
import { CUSTOMER_WORKSPACE as M } from "@metastorage/shared";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import axios from "axios";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { api } from "../../lib/api";
import { prepareImageUpload } from "../../lib/prepare-image-upload";
import {
  customerCommandId,
  readCustomerCommand,
  saveCustomerCommand,
  sharePrivateFile,
} from "./customer-native";

export function customerError(error: unknown) {
  if (axios.isAxiosError(error) && (!error.response || error.response.status >= 500))
    return M.error;
  return axios.isAxiosError(error)
    ? (error.response?.data?.error?.message ?? M.error)
    : error instanceof Error
      ? error.message
      : M.error;
}
export function useCustomerTicket(owner: string, id: string) {
  const detail = useQuery({
    queryKey: ["support-ticket", owner, id],
    queryFn: ({ signal }) => api.support.detail(id, signal),
  });
  const messages = useInfiniteQuery({
    queryKey: ["support-messages", owner, id],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      api.support.messages(id, { limit: 20, cursor: pageParam }, signal),
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const replyForm = useForm<SupportReplyInput>({
    resolver: zodResolver(SupportReplyInputSchema),
    defaultValues: { content: "", version: 0, idempotencyKey: customerCommandId() },
  });
  const content = replyForm.watch("content");
  const setContent = (value: string) => replyForm.setValue("content", value);
  const [image, setImage] = useState<Omit<SupportImageInput, "version" | "idempotencyKey">>();
  const [notice, setNotice] = useState("");
  const replyCommand = useRef<SupportReplyInput | undefined>(undefined);
  const uploadCommand = useRef<{ messageId: string; input: SupportImageInput } | undefined>(
    undefined,
  );
  useEffect(() => {
    void readCustomerCommand<SupportReplyInput>(owner, `reply-${id}`).then((saved) => {
      if (saved) {
        replyCommand.current = saved;
        replyForm.setValue("content", saved.content);
      }
    });
  }, [owner, id, replyForm.setValue]);
  const refresh = async () => {
    await Promise.all([detail.refetch(), messages.refetch()]);
  };
  const onError = async (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 409) {
      await refresh();
      replyCommand.current = undefined;
      uploadCommand.current = undefined;
      setNotice(M.conflict);
    } else setNotice(customerError(error));
  };
  const reply = useMutation({
    mutationFn: async () => {
      if (!replyCommand.current || replyCommand.current.content !== content.trim()) {
        if (!detail.data) throw new Error();
        replyCommand.current = {
          content: content.trim(),
          version: detail.data.ticket.version,
          idempotencyKey: customerCommandId(),
        };
      }
      await saveCustomerCommand(owner, `reply-${id}`, replyCommand.current);
      return api.support.reply(id, replyCommand.current);
    },
    onSuccess: async () => {
      replyCommand.current = undefined;
      setContent("");
      await saveCustomerCommand(owner, `reply-${id}`, null);
      await refresh();
    },
    onError,
  });
  const pick = useMutation({
    mutationFn: async () => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        base64: true,
        quality: 1,
      });
      const asset = result.assets?.[0];
      if (result.canceled || !asset) return;
      setImage(prepareImageUpload(asset, SUPPORT_IMAGE_MAX_BYTES));
      uploadCommand.current = undefined;
    },
    onError,
  });
  const upload = useMutation({
    mutationFn: async (messageId: string) => {
      if (!image) return;
      if (!uploadCommand.current) {
        if (!detail.data) throw new Error();
        uploadCommand.current = {
          messageId,
          input: {
            ...image,
            version: detail.data.ticket.version,
            idempotencyKey: customerCommandId(),
          },
        };
      }
      return api.support.uploadImage(
        id,
        uploadCommand.current.messageId,
        uploadCommand.current.input,
      );
    },
    onSuccess: async () => {
      uploadCommand.current = undefined;
      setImage(undefined);
      await refresh();
    },
    onError,
  });
  const openImage = useMutation({
    mutationFn: async ({
      imageId,
      filename,
      mimeType,
    }: {
      imageId: string;
      filename: string;
      mimeType: string;
    }) => {
      const bytes = await api.support.image(id, imageId);
      await sharePrivateFile(new Uint8Array(bytes), `${imageId}-${filename}`, mimeType);
    },
    onError,
  });
  return { detail, messages, content, setContent, image, notice, reply, pick, upload, openImage };
}
