/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Channel, Embed, MessageAttachment } from "@vencord/discord-types";
import { Component, ReactNode } from "react";

export const VIDEO_TAB_ID = "videos";

export const FavouriteItemFormat = {
    NONE: 0,
    IMAGE: 1,
    VIDEO: 2
} as const;
export type FavouriteItemFormat = typeof FavouriteItemFormat[keyof typeof FavouriteItemFormat];

export interface FavouriteItem {
    format: FavouriteItemFormat;
    src: string;
    width: number;
    height: number;
    order: number;
}

export interface FavoriteButtonProps extends Omit<FavouriteItem, "order"> {
    url: string;
    className?: string;
}

export interface EmbedComponent extends Component<{ embed: Embed; }> {
    __render: () => ReactNode;
}

export interface AttachmentItem<TOriginal = MessageAttachment> {
    contentType: string;
    type: "IMAGE" | "VIDEO" | "CLIP" | "AUDIO" | "VISUAL_PLACEHOLDER" | "PLAINTEXT_PREVIEW" | "OTHER" | "INVALID";
    width?: number;
    height?: number;
    downloadUrl: string;
    spoiler: boolean;
    srcIsAnimated: boolean;
    uniqueId: string;
    originalItem: TOriginal;
}

export interface CV2Attachment {
    url: string;
    proxyUrl: string;
    width: number;
    height: number;
    placeholder?: string;
    contentType: string;
    flags: number;
}

export interface VideoTabProps {
    channel: Channel;
    closePopout: () => void;
}

export type AttachmentTransformer = (attachment: MessageAttachment, inlineAttachmentMedia?: boolean) => AttachmentItem;
