"use client";
import { RiGithubFill, RiPencilLine } from "react-icons/ri";
import { ICON_SIZE } from "@/constants";
import { useIsAdminPage } from "./hooks/useIsAdminPage";
import { IconLink } from "./ui";

export const CategoryEdit = ({ path }: { path?: string }) => {
  const { isAdmin: isAdminPage } = useIsAdminPage();
  if (!path || isAdminPage) return null;

  return (
    <div className="flex gap-2 justify-center items-start sm:items-center">
      <IconLink href={`admin/index.html#/collections/edit/category/${path?.slice(0, -4)}`} title="Edit category with TinaCMS" tooltipOpaque={true}>
        <RiPencilLine className="hover:text-tinacms" size={ICON_SIZE} />
      </IconLink>
      <IconLink
        href={`https://github.com/SSWConsulting/SSW.Rules.Content/commits/${process.env.NEXT_PUBLIC_TINA_BRANCH}/categories/${path}`}
        target="_blank"
        title="View category on GitHub"
        tooltipOpaque={true}
      >
        <RiGithubFill size={ICON_SIZE} />
      </IconLink>
    </div>
  );
};
