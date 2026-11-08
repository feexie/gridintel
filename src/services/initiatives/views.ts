import type { PublicViewId } from "../../constants/initiatives.ts";
import type { RailItemId, ViewId, WorkspaceType } from "../../constants/workspaces.ts";

/* ==========================================================
   SERVICES — THE FRONT DOOR'S VIEW MODELS (ADR 0021, draft)

   What the public layer and the workspace shell receive. Plain,
   serialisable data. Every figure arrives formatted, with its
   status, its origin, whether it rests on synthetic records, and
   one line on where it came from; the UI calculates nothing.
========================================================== */

/** Where a card's figure comes from, in the words shown on screen. */
export type InitiativeFigureOrigin = "reported" | "calculated";

export interface InitiativeFigureView {
  /** The catalogue's figure id, or the key of a summary figure. */
  id: string;
  label: string;
  /** Formatted; null when the figure is not available. */
  value: string | null;
  status: "ok" | "not_available";
  /** Null when the figure is not available. */
  origin: InitiativeFigureOrigin | null;
  /** True when any record behind the figure is synthetic: shown as such. */
  synthetic: boolean;
  /** The source and date, or the method in words; for a figure not available, what is missing and where it would come from. */
  basis: string;
  /** A share from 0 to 1 for a progress bar; null when the figure is not a share or is not available. */
  share: number | null;
}

export interface InitiativeCardView {
  id: string;
  title: string;
  summary: string;
  href: string;
  headline: InitiativeFigureView;
  /** The figure the bar shows; null when the card has none. */
  progress: InitiativeFigureView | null;
  secondary: InitiativeFigureView | null;
}

export interface RoleOptionView {
  id: string;
  label: string;
  description: string;
  audience: "public" | "organization";
  href: string;
}

export interface RolePickerView {
  id: string;
  title: string;
  summary: string;
  roles: RoleOptionView[];
}

/** An organization role's page: sign in, or open the demo workspace of its type. */
export interface SignInHandoffView {
  initiativeId: string;
  initiativeTitle: string;
  roleLabel: string;
  workspaceType: WorkspaceType;
  workspaceTypeLabel: string;
  /** The tenant deployment's sign-in page; null until it is set in configuration. */
  signInHref: string | null;
  demoHref: string;
  demoName: string;
}

export interface PublicRoleView {
  initiativeId: string;
  initiativeTitle: string;
  roleLabel: string;
  view: PublicViewId;
}

export interface ViewLinkView {
  id: ViewId;
  label: string;
  question: string;
  /** Where the screen is today; null when it has no page yet. */
  href: string | null;
  planned: boolean;
}

/** A workspace, as its header and the switcher show it. */
export interface WorkspaceSummaryView {
  id: string;
  name: string;
  /** Up to two letters, for the fallback mark when there is no logo. */
  initials: string;
  /** An image address under /images; null for the GridIntel fallback. */
  logo: string | null;
  type: WorkspaceType;
  typeLabel: string;
  /** Read-only, synthetic, open without login, badged DEMO. */
  demo: boolean;
  synthetic: boolean;
  href: string;
}

export interface RailItemView {
  item: RailItemId;
  label: string;
  question: string;
  href: string;
}

export interface WorkspaceFrameView {
  current: WorkspaceSummaryView;
  /** The other workspaces the visitor may switch to: the other demo workspaces, here. */
  others: WorkspaceSummaryView[];
  rail: RailItemView[];
  reportsHref: string;
}

export interface WorkspaceHomeView {
  workspace: WorkspaceSummaryView;
  cards: InitiativeCardView[];
}

export interface WorkspaceInitiativeView {
  workspace: WorkspaceSummaryView;
  card: InitiativeCardView;
  roleLabel: string;
  views: ViewLinkView[];
}

export interface RailItemPageView {
  workspace: WorkspaceSummaryView;
  item: RailItemId;
  label: string;
  question: string;
  views: ViewLinkView[];
  /** The view shown inside the shell in NAV-A; null when the item only lists its views. */
  filled: ViewId | null;
}

export interface MinigridSummaryView {
  figures: InitiativeFigureView[];
  synthetic: boolean;
}
