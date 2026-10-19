import { Fragment, isValidElement, type ReactNode } from "react";
import { humanizeForScreen } from "@/config/technical-codes";

/** Only notice text; never transform form values, identifiers or domain records. */
export function noticeText(value: ReactNode): ReactNode {
  if (typeof value === "string") return humanizeForScreen(value);
  if (Array.isArray(value)) return value.map(noticeText);
  if (isValidElement<{ children?: ReactNode }>(value) && value.type === Fragment)
    return <Fragment key={value.key}>{noticeText(value.props.children)}</Fragment>;
  return value;
}