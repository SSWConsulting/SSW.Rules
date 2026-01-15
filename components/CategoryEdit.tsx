"use client";
import { RiGithubFill, RiPencilLine } from "react-icons/ri";
import { ICON_SIZE } from "@/constants";
import { setTinaBranchToMainIfExists } from "@/utils/tina/set-branch";
import { useIsAdminPage } from "./hooks/useIsAdminPage";
import { IconLink } from "./ui";

export const CategoryEdit = ({ path }: { path?: string }) => {
  const { isAdmin: isAdminPage } = useIsAdminPage();
  if (!path || isAdminPage) return null;

  return (
    <div className="flex gap-4 justify-center items-start mt-2 pr-0 sm:pr-4">
      <IconLink
        href={`/admin/index.html#/collections/edit/category/${path?.slice(0, -4)}`}
        title="Edit category with TinaCMS"
        tooltipOpaque={true}
        onClick={setTinaBranchToMainIfExists}
      >
        <RiPencilLine size={ICON_SIZE} />
      </IconLink>
      <IconLink
        href={`https://github.com/SSWConsulting/SSW.Rules.Content/blob/${process.env.NEXT_PUBLIC_TINA_BRANCH}/categories/${path}`}
        target="_blank"
        title="View category on GitHub"
        tooltipOpaque={true}
      >
        <RiGithubFill size={ICON_SIZE} />
      </IconLink>
    </div>
  );
};
