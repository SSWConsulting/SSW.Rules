"use client";

import classNames from "classnames";
import { Suspense } from "react";
import { RiAddCircleFill, RiOpenaiFill, RiQuestionFill } from "react-icons/ri";
import { MegaMenuLayout } from "ssw.megamenu";
import { getSanitizedBasePath } from "@/lib/withBasePath";
import SignIn from "../auth/SignIn";
import { CustomLink } from "../customLink";
import useAppInsights from "../hooks/useAppInsights";
import Tooltip from "../tooltip/tooltip";

const basePath = getSanitizedBasePath();

export function MegaMenuWrapper(props) {
  const linkComponent = (linkProps: any) => {
    const { href, ...restProps } = linkProps;

    let adjustedHref = href;
    if (basePath && href && typeof href === "string") {
      // Only adjust relative URLs (not external URLs, and not the home path "/")
      if (!href.startsWith("http://") && !href.startsWith("https://") && href.startsWith("/") && href !== "/") {
        // Convert absolute path to relative path that escapes basePath
        // /some-path becomes ../some-path
        const pathWithoutSlash = href.slice(1);
        adjustedHref = `../${pathWithoutSlash}`;
      }
    }

    return <CustomLink {...restProps} href={adjustedHref} className={classNames("unstyled", linkProps.className)} />;
  };

  return (
    <div className="mx-auto max-w-7xl px-0">
      <MegaMenuLayout
        title="Rules"
        menuBarItems={props.menu}
        subtitle="Secret ingredients to quality software"
        rightSideActionsOverride={() => <ActionButtons />}
        linkComponent={linkComponent}
        url="/"
        searchUrl="https://www.ssw.com.au/rules"
        isFlagVisible={false}
      />
    </div>
  );
}

const ActionButtons = () => {
  const { trackEvent } = useAppInsights();

  return (
    <div className="action-btn-container max-sm:order-2 max-sm:mt-4 flex justify-between items-center w-full gap-4">
      <div className="flex items-center gap-4">
        <Tooltip text="Try out RulesGPT" showDelay={3000} hideDelay={18000}>
          <a
            target="_blank"
            rel="noopener noreferrer nofollow"
            href="https://rulesgpt.ssw.com.au"
            className="action-btn-link-underlined"
            onClick={() => {
              trackEvent("RulesGPTButtonPressed");
            }}
            aria-label="Try out RulesGPT"
          >
            <RiOpenaiFill className="header-icon" />
          </a>
        </Tooltip>

        <Tooltip text="Create an SSW Rule" showDelay={1000} hideDelay={3000}>
          <a
            target="_blank"
            rel="noopener noreferrer nofollow"
            href={`/${basePath}/admin/index.html#/collections/rule/~`}
            className="action-btn-link-underlined"
            aria-label="Create an SSW Rule"
          >
            <RiAddCircleFill className="header-icon" />
          </a>
        </Tooltip>

        <Tooltip text="SSW Rules wiki" showDelay={1000} hideDelay={3000}>
          <a
            target="_blank"
            rel="noopener noreferrer nofollow"
            href="https://github.com/SSWConsulting/SSW.Rules.Content/wiki"
            className="action-btn-link-underlined"
            aria-label="SSW Rules wiki"
          >
            <RiQuestionFill className="header-icon" />
          </a>
        </Tooltip>
      </div>

      <Suspense fallback={<div className="w-8 h-8" />}>
        <SignIn />
      </Suspense>
    </div>
  );
};
