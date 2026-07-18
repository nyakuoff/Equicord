/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { Embed, MessageAttachment } from "@vencord/discord-types";
import { proxyLazyWebpack } from "@webpack";
import { React } from "@webpack/common";
import { ReactNode } from "react";

import { AttachmentAccessory, EmbedAccessory, isOwnFavouritedVideoSrc, VideoTab } from "./components";
import managedStyle from "./style.css?managed";
import { AttachmentItem, CV2Attachment, EmbedComponent, FavouriteItem, FavouriteItemFormat, VIDEO_TAB_ID, VideoTabProps } from "./types";

export const EmbedContext = proxyLazyWebpack(() => React.createContext<null | Embed>(null));
export const AttachmentContext = proxyLazyWebpack(() => React.createContext<null | AttachmentItem>(null));

export default definePlugin({
    name: "FavouriteVideos",
    description: "Adds a dedicated picker tab for your favourited videos, and lets you favourite any video attachment or embed straight from chat.",
    tags: ["Chat", "Media"],
    authors: [EquicordDevs.nyakuoff],
    managedStyle,
    patches: [
        // EMBEDS
        {
            find: "this.renderInlineMediaEmbed",
            replacement: {
                // Wrap the embed component's render method in a custom context to avoid having to drill props
                match: "render()",
                replace: "$&{return $self.renderEmbed.call(this)}__render()"
            }
        },
        {
            // Override the default renderAdjacentContent prop value for all types of embed components
            // The negative lookahead skips identifiers already assigned a default (e.g. by another plugin patching the same spot)
            find: "#{intl::MEDIA_MOSAIC_ALT_TEXT_POPOUT_TITLE}",
            replacement: {
                match: /renderAdjacentContent:(\i)(?!=)/g,
                replace: "renderAdjacentContent:$1=$self.renderEmbedAccessory"
            }
        },
        // ATTACHMENTS
        {
            find: '["VIDEO","CLIP","AUDIO"]',
            replacement: [
                {
                    // Wrap the attachment component in a custom context to avoid having to drill props
                    match: /(?<=children:)(\i)=>(\i\(\1\))\}\):(\i\(\))/,
                    replace: "$1=>$self.renderAttachment($2,arguments[0])}):$self.renderAttachment($3,arguments[0])"
                },
                {
                    // Always add our custom accessory to the attachment's adjacent content
                    match: "=[];",
                    replace: "=[$self.renderAttachmentAccessory()];"
                }
            ]
        },
        {
            // Hide our own favourited videos from the native GIF tab's own Favorites view - they get
            // their own dedicated Videos tab instead, so showing them in both would just be duplicated.
            find: '.sortBy("order").reverse().value()',
            replacement: {
                match: '.sortBy("order").reverse()',
                replace: "$&.filter($self.filterOutOwnVideos)"
            }
        },
        // EXPRESSION PICKER
        // Appends a brand new "Videos" tab and panel next to the native tabs, anchored on the sticker
        // tab/panel (not the GIF one) so this coexists with plugins that rework the GIF tab itself.
        {
            find: "#{intl::EXPRESSION_PICKER_CATEGORIES_A11Y_LABEL}",
            replacement: [
                {
                    match: /(?<=(\i)\?(\(.{0,15}\))\((\i),\{.{0,150}(\i)===\i\.\i\.STICKER,.{0,150}children:(.{0,50}\.\i,children:.{0,50})\}\)\}\):null)/,
                    replace: `,vcFavouriteVideos=$2($3,{id:"favourite-videos-picker-tab","aria-controls":"favourite-videos-picker-tab-panel","aria-selected":$4==="${VIDEO_TAB_ID}",isActive:$4==="${VIDEO_TAB_ID}",viewType:"${VIDEO_TAB_ID}",children:"Videos"})`
                },
                {
                    match: /children:\[\i,\i(?=.{0,150}\.SOUNDBOARD)/g,
                    replace: "$&,vcFavouriteVideos"
                },
                {
                    match: /:null,((.{1,200})===.{1,30}\.STICKER&&\w+\?(\([^()]{1,10}\)).{1,15}?(\{.*?,onSelectSticker:.*?\})\):null)/,
                    replace: `:null,$2==="${VIDEO_TAB_ID}"?$3($self.renderVideoTab,$4):null,$1`
                }
            ]
        }
    ],
    renderEmbed(this: EmbedComponent) {
        return <EmbedContext.Provider value={this.props.embed}>{this.__render()}</EmbedContext.Provider>;
    },
    renderAttachment(children: ReactNode, props: { item: AttachmentItem<MessageAttachment | { media: CV2Attachment; }>; }) {
        const { item: { originalItem, ...rest } } = props;

        // Regular message attachments and Components V2 media attachments are structured differently
        const raw: MessageAttachment =
            "media" in originalItem
                ? {
                    ...originalItem.media,
                    id: rest.uniqueId,
                    size: 0,
                    spoiler: rest.spoiler,
                    filename: (rest.spoiler ? "SPOILER_" : "") + rest.uniqueId,
                    content_type: originalItem.media.contentType,
                    proxy_url: originalItem.media.proxyUrl
                }
                : originalItem;

        return <AttachmentContext.Provider value={{ originalItem: raw, ...rest }}>{children}</AttachmentContext.Provider>;
    },
    renderAttachmentAccessory: () => <AttachmentAccessory />,
    renderEmbedAccessory: () => <EmbedAccessory />,
    renderVideoTab({ channel, closePopout }: VideoTabProps) {
        return <VideoTab channel={channel} closePopout={closePopout} />;
    },
    filterOutOwnVideos: (item: FavouriteItem) =>
        item.format !== FavouriteItemFormat.VIDEO || !isOwnFavouritedVideoSrc(item.src)
});
