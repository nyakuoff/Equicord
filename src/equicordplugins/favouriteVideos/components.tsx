/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText } from "@components/BaseText";
import ErrorBoundary from "@components/ErrorBoundary";
import { classNameFactory } from "@utils/css";
import { sendMessage } from "@utils/discord";
import { findComponentByCodeLazy, findCssClassesLazy } from "@webpack";
import { PermissionsBits, PermissionStore, React, useCallback, useEffect, useRef, UserSettingsActionCreators, UserSettingsProtoStore, useStateFromStores } from "@webpack/common";

import { AttachmentContext, EmbedContext } from ".";
import { FavoriteButtonProps, FavouriteItem, FavouriteItemFormat, VideoTabProps } from "./types";

const FavoriteButton = findComponentByCodeLazy<FavoriteButtonProps>("#{intl::GIF_TOOLTIP_ADD_TO_FAVORITES}");

const Classes = findCssClassesLazy("gifFavoriteButton", "ctaButtonContainer");

export const cl = classNameFactory("vc-favouriteVideos-");

// Discord's own GIFs are technically served as short videos under the hood, so a favourited GIF and a
// favourited video attachment/embed both land in favoriteGifs.gifs with the exact same format: VIDEO.
// GIF-picker entries can come from arbitrary sites (Discord's gif search indexes GIFs across the web,
// not just Tenor/Klipy/Giphy), so a host allowlist alone can't catch everything - most are keyed by the
// gif's own *page* url (e.g. tenor.com/view/..., imgur.com/a/...) with no file extension, unlike a video
// we star from chat, which is always keyed by an actual media file url (Discord CDN attachment link or a
// direct video link). But some providers (Giphy) key their entries by their own direct .mp4 file url
// instead of a page url, so that alone isn't enough either - excluding known gif-CDN hosts on top of the
// extension check catches those without needing a host allowlist for gif-picker results in general.
const VIDEO_FILE_EXTENSION = /\.(mp4|webm|mov|m4v|mkv)$/i;
const GIF_CDN_HOST_SUFFIXES = ["tenor.com", "tenor.co", "klipy.com", "giphy.com"];

function isFavouritedVideoUrl(url: string): boolean {
    const parsed = URL.parse(url);
    if (!parsed || !VIDEO_FILE_EXTENSION.test(parsed.pathname)) return false;

    const { hostname } = parsed;
    return !GIF_CDN_HOST_SUFFIXES.some(suffix => hostname === suffix || hostname.endsWith(`.${suffix}`));
}

function useFavouriteVideos(): (FavouriteItem & { url: string; })[] {
    useEffect(() => void UserSettingsActionCreators.FrecencyUserSettingsActionCreators.loadIfNecessary(), []);

    return useStateFromStores(
        [UserSettingsProtoStore],
        () => {
            const items: Record<string, FavouriteItem> | null =
                UserSettingsProtoStore.frecencyWithoutFetchingLatest.favoriteGifs?.gifs;
            if (!items) return [];

            return Object.entries(items)
                .filter(([url, item]) => item.format === FavouriteItemFormat.VIDEO && isFavouritedVideoUrl(url))
                .map(([url, item]) => ({ ...item, url }))
                .sort((a, b) => b.order - a.order);
        },
        [],
        (prev, next) => prev.length === next.length && prev.every((item, i) => item.url === next[i].url)
    );
}

function EmbedAccessoryInner() {
    const embed = React.useContext(EmbedContext);
    const video = embed?.video;
    const proxyURL = video?.proxyURL;

    if (!embed || embed.type === "gifv" || !video || !proxyURL) return null;

    const props: FavoriteButtonProps = { format: FavouriteItemFormat.VIDEO, src: proxyURL, url: video.url, width: video.width ?? 0, height: video.height ?? 0 };

    return (
        <div className={cl("embed-accessory")}>
            <FavoriteButton {...props} className={Classes.gifFavoriteButton} />
        </div>
    );
}
export const EmbedAccessory = ErrorBoundary.wrap(EmbedAccessoryInner, { noop: true });

function AttachmentAccessoryInner() {
    const attachment = React.useContext(AttachmentContext);

    if (!attachment?.downloadUrl) return null;
    if (attachment.type !== "VIDEO" && attachment.type !== "CLIP") return null;

    const { originalItem, downloadUrl } = attachment;
    const width = attachment.width || 600, height = attachment.height || 400;
    const props: FavoriteButtonProps = { format: FavouriteItemFormat.VIDEO, src: originalItem.proxy_url, url: downloadUrl, width, height };

    return <FavoriteButton {...props} className={cl("attachment-accessory")} />;
}
export const AttachmentAccessory = ErrorBoundary.wrap(AttachmentAccessoryInner, { noop: true });

function VideoTile({ item, canSend, onSend }: { item: FavouriteItem & { url: string; }; canSend: boolean; onSend: (url: string) => void; }) {
    const videoRef = useRef<HTMLVideoElement>(null);

    return (
        <div className={cl("tile")}>
            <video
                ref={videoRef}
                src={item.src}
                muted
                loop
                playsInline
                preload="metadata"
                className={cl("video")}
                onMouseEnter={() => videoRef.current?.play()}
                onMouseLeave={() => {
                    const video = videoRef.current;
                    if (!video) return;
                    video.pause();
                    video.currentTime = 0;
                }}
                onClick={() => canSend && onSend(item.url)}
            />
            <FavoriteButton
                format={item.format}
                src={item.src}
                url={item.url}
                width={item.width}
                height={item.height}
                className={cl("tile-favorite-button")}
            />
        </div>
    );
}

function VideoTabInner({ channel, closePopout }: VideoTabProps) {
    const items = useFavouriteVideos();

    const canSend = useStateFromStores(
        [PermissionStore],
        () => channel.isPrivate() || PermissionStore.can(PermissionsBits.SEND_MESSAGES, channel),
        [channel]
    );

    const handleSend = useCallback((url: string) => {
        sendMessage(channel.id, { content: url });
        closePopout();
    }, [channel.id, closePopout]);

    return (
        <div id="favourite-videos-picker-tab-panel" role="tabpanel" aria-labelledby="favourite-videos-picker-tab" className={cl("container")}>
            {items.length > 0 ? (
                <div className={cl("grid")}>
                    {items.map(item => (
                        <VideoTile key={item.url} item={item} canSend={canSend} onSend={handleSend} />
                    ))}
                </div>
            ) : (
                <div className={cl("empty")}>
                    <BaseText className={cl("empty-text")}>
                        Favourite a video by clicking the star on any video in chat.
                    </BaseText>
                </div>
            )}
        </div>
    );
}
export const VideoTab = ErrorBoundary.wrap(VideoTabInner, { noop: true });
