import {
  Notebook01Icon,
  Plant01Icon,
  ShieldUserIcon,
} from "@hugeicons/core-free-icons"

/** Shared with home page and loading fallback so copy stays in sync. */
export const homeAudienceRoles = [
  {
    icon: Plant01Icon,
    title: "Farmers",
    description: "Fields, observations, and photos in one place.",
  },
  {
    icon: Notebook01Icon,
    title: "Agronomists",
    description: "Publish advisories with dates, limits, and attachments.",
  },
  {
    icon: ShieldUserIcon,
    title: "Administrators",
    description: "Verify agronomists and moderate when needed.",
  },
] as const
