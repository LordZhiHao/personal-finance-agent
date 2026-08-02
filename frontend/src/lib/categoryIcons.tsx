import {
  ArrowLeftRight,
  Banknote,
  Bus,
  Film,
  HeartPulse,
  ShoppingBag,
  ShoppingCart,
  Tag,
  TrendingUp,
  Utensils,
  Zap,
  type LucideIcon,
} from "lucide-react";

/** Keyed off the built-in categories in utils/constants.py::CATEGORIES.
 * Any custom category a user has added falls back to the generic Tag icon below. */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "Food & Drink": Utensils,
  Transport: Bus,
  Shopping: ShoppingBag,
  Groceries: ShoppingCart,
  Entertainment: Film,
  Health: HeartPulse,
  Utilities: Zap,
  Salary: Banknote,
  Investment: TrendingUp,
  Transfer: ArrowLeftRight,
  Other: Tag,
};

export function iconForCategory(category: string): LucideIcon {
  return CATEGORY_ICONS[category] ?? Tag;
}
