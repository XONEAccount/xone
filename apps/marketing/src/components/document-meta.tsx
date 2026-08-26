import { useEffect } from "react";

type DocumentMetaProps = {
  title: string;
  description: string;
};

/**
 * Sets document title and meta description for the current route.
 * @param props - Title and description
 */
export function DocumentMeta({ title, description }: DocumentMetaProps) {
  useEffect(() => {
    document.title = title;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", description);
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute("content", title);
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute("content", description);
  }, [title, description]);

  return null;
}
