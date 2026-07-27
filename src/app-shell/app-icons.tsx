import type { SVGProps } from "react";
import { ArticleIcon } from "@phosphor-icons/react/dist/csr/Article";
import { BellIcon } from "@phosphor-icons/react/dist/csr/Bell";
import { BriefcaseMetalIcon } from "@phosphor-icons/react/dist/csr/BriefcaseMetal";
import { CameraIcon } from "@phosphor-icons/react/dist/csr/Camera";
import { ChatCircleDotsIcon } from "@phosphor-icons/react/dist/csr/ChatCircleDots";
import { ChatsCircleIcon } from "@phosphor-icons/react/dist/csr/ChatsCircle";
import { HouseLineIcon } from "@phosphor-icons/react/dist/csr/HouseLine";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { NewspaperClippingIcon } from "@phosphor-icons/react/dist/csr/NewspaperClipping";
import { UsersThreeIcon } from "@phosphor-icons/react/dist/csr/UsersThree";
import { WrenchIcon } from "@phosphor-icons/react/dist/csr/Wrench";

export interface AppIconProps extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  active?: boolean;
  size?: number | string;
}

function iconWeight(active = false) {
  return active ? "duotone" : "regular";
}

export function HomeDestinationIcon({ active, size = 22, ...props }: AppIconProps) {
  return <HouseLineIcon data-app-icon="home" size={size} weight={iconWeight(active)} {...props} />;
}

export function WorkDestinationIcon({ active, size = 22, ...props }: AppIconProps) {
  return <BriefcaseMetalIcon data-app-icon="work" size={size} weight={iconWeight(active)} {...props} />;
}

export function CameraDestinationIcon({ active, size = 22, ...props }: AppIconProps) {
  return <CameraIcon data-app-icon="camera" size={size} weight={iconWeight(active)} {...props} />;
}

export function ShopTalkDestinationIcon({ active, size = 22, ...props }: AppIconProps) {
  return <ChatsCircleIcon data-app-icon="shop-talk" size={size} weight={iconWeight(active)} {...props} />;
}

export function ToolsDestinationIcon({ active, size = 22, ...props }: AppIconProps) {
  return <WrenchIcon data-app-icon="tools" size={size} weight={iconWeight(active)} {...props} />;
}

export function JobsSectionIcon({ active, size = 18, ...props }: AppIconProps) {
  return <BriefcaseMetalIcon data-app-icon="jobs" size={size} weight={iconWeight(active)} {...props} />;
}

export function PeopleSectionIcon({ active, size = 18, ...props }: AppIconProps) {
  return <UsersThreeIcon data-app-icon="people" size={size} weight={iconWeight(active)} {...props} />;
}

export function FeedSectionIcon({ active, size = 18, ...props }: AppIconProps) {
  return <ArticleIcon data-app-icon="feed" size={size} weight={iconWeight(active)} {...props} />;
}

export function CommunitiesSectionIcon({ active, size = 18, ...props }: AppIconProps) {
  return <UsersThreeIcon data-app-icon="communities" size={size} weight={iconWeight(active)} {...props} />;
}

export function TradeNewsSectionIcon({ active, size = 18, ...props }: AppIconProps) {
  return <NewspaperClippingIcon data-app-icon="trade-news" size={size} weight={iconWeight(active)} {...props} />;
}

export function SearchCommandIcon({ size = 20, ...props }: AppIconProps) {
  return <MagnifyingGlassIcon data-command-icon="search" size={size} weight="regular" {...props} />;
}

export function MessagesCommandIcon({ size = 20, ...props }: AppIconProps) {
  return <ChatCircleDotsIcon data-command-icon="messages" size={size} weight="regular" {...props} />;
}

export function NotificationsCommandIcon({ size = 20, ...props }: AppIconProps) {
  return <BellIcon data-command-icon="notifications" size={size} weight="regular" {...props} />;
}
