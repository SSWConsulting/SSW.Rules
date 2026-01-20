import moment from "moment";
import React from "react";
import { FaFacebook, FaHeart, FaInstagram, FaLinkedin, FaTiktok, FaXTwitter, FaYoutube } from "react-icons/fa6";
import { GitHubButtonWrapper } from "@/components/GitHubButtonWrapper";
import { pathPrefix } from "../../../site-config";

const buildTimestamp = process.env.BUILD_TIMESTAMP ? parseInt(process.env.BUILD_TIMESTAMP) : Date.now() - 1000 * 60 * 30;
const versionDeployed = process.env.VERSION_DEPLOYED || "dev";
const deploymentUrl = process.env.DEPLOYMENT_URL || "#";
const buildDate = process.env.BUILD_DATE;
const commitHash = process.env.COMMIT_HASH;

export const Footer = () => {
  return (
    <>
      <div className="p-4 text-center bg-gray-500/10 text-sm">
        <section className="main-container flex max-sm:flex-col items-center justify-center gap-2">
          <span>
            We <FaHeart className="text-ssw-red inline" size={12} /> open source.
          </span>
          <span>
            Loving SSW Rules?{" "}
            <a href="https://github.com/SSWConsulting/SSW.Rules" target="_blank" rel="noopener noreferrer nofollow" className="action-button-label underline hover:underline">
              Star us on GitHub.
            </a>{" "}
          </span>
          <GitHubButtonWrapper />
        </section>
      </div>
      <footer className="bg-[var(--footer-background)] text-[var(--footer-foreground)] py-6 md:py-4 lg:py-2  [&_a]:no-underline text-xs">
        <section className="main-container">
          <div className="xl:mx-6">
            <div className="mx-6 flex flex-col-reverse md:flex-row justify-between align-middle leading-6">
              <div className="py-2">&copy; 1990-{new Date().getFullYear()} SSW. All rights reserved.</div>
              <div className="w-full md:w-3/6 md:text-right py-2 flex max-sm:flex-col max-sm:items-start items-center max-sm:justify-start justify-center md:justify-end">
                <a
                  className="inline-block text-white visited:text-white leading-3 transition-all duration-300 ease-in-out hover:text-ssw-red max-sm:mb-3"
                  href="https://github.com/SSWConsulting/SSW.Rules/issues"
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                >
                  FEEDBACK / SUGGEST A FEATURE
                </a>
                <span className="px-2 hidden sm:inline">|</span>
                <a
                  className="inline-block text-white visited:text-white leading-3 transition-all duration-300 ease-in-out hover:text-ssw-red max-sm:mb-3"
                  href="https://www.ssw.com.au/terms-and-conditions"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  TERMS AND CONDITIONS
                </a>
                <span className="px-2 hidden sm:inline">|</span>
                <div className="inline-flex flex-row-reverse justify-end flex-nowrap">
                  <a
                    className="unstyled block float-right h-[25px] w-[25px] ml-2 text-white visited:text-white no-underline text-center leading-[25px]"
                    id="tiktok-icon"
                    title="SSW on TikTok"
                    href="https://www.tiktok.com/@ssw_tv"
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                  >
                    <FaTiktok size={24} />
                  </a>
                  <a
                    className="unstyled block float-right h-[25px] w-[25px] ml-2 text-white visited:text-white no-underline text-center leading-[25px]"
                    id="twitter-icon"
                    title="SSW on Twitter"
                    href="https://twitter.com/SSW_TV"
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                  >
                    <FaXTwitter size={24} />
                  </a>
                  <a
                    className="unstyled block float-right h-[25px] w-[25px] ml-2 text-white visited:text-white no-underline text-center leading-[25px]"
                    id="instagram-icon"
                    title="SSW on Instagram"
                    href="https://www.instagram.com/ssw_tv"
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                  >
                    <FaInstagram size={24} />
                  </a>
                  <a
                    className="unstyled block float-right h-[25px] w-[25px] ml-2 text-white visited:text-white no-underline text-center leading-[25px]"
                    id="facebook-icon"
                    title="SSW on Facebook"
                    href="https://www.facebook.com/SSW.page"
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                  >
                    <FaFacebook size={24} />
                  </a>
                  <a
                    className="unstyled block float-right h-[25px] w-[25px] ml-2 text-white visited:text-white no-underline text-center leading-[25px]"
                    id="linkedin-icon"
                    title="SSW on LinkedIn"
                    href="https://www.linkedin.com/company/ssw"
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                  >
                    <FaLinkedin size={24} />
                  </a>
                  <a
                    className="unstyled block float-right h-[25px] w-[25px] ml-2 text-white visited:text-white no-underline text-center leading-[25px]"
                    id="youtube-icon"
                    title="SSW on YouTube"
                    href="https://www.youtube.com/user/sswtechtalks"
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                  >
                    <FaYoutube size={24} />
                  </a>
                </div>
              </div>
            </div>
            <hr className="border-gray-800 my-2"></hr>
            <div className="flex flex-col md:flex-row justify-between mx-6">
              <div className="py-2">
                This website is under{" "}
                <a
                  className="inline-block text-white visited:text-white leading-3 transition-all duration-300 ease-in-out hover:text-ssw-red"
                  href={`${pathPrefix}/rules-to-better-websites-deployment`}
                >
                  CONSTANT CONTINUOUS DEPLOYMENT
                </a>
                . Last deployed {getLastDeployTime()} ago
                {buildDate && <span title={buildDate}> on {moment(buildDate).format("MMM D, YYYY [at] HH:mm UTC")}</span>} (Build #{" "}
                <a
                  className="inline-block text-white visited:text-white leading-3 transition-all duration-300 ease-in-out hover:text-ssw-red"
                  href={deploymentUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                >
                  {versionDeployed}
                </a>
                {commitHash && <span title={`Commit: ${commitHash}`}>-{commitHash}</span>})
              </div>
              <div className="md:text-right py-2">
                Powered by{" "}
                <a
                  className="inline-block text-white visited:text-white leading-3 transition-all duration-300 ease-in-out hover:text-ssw-red"
                  href={`${pathPrefix}/rules-to-better-azure`}
                >
                  Azure
                </a>{" "}
                and{" "}
                <a
                  className="inline-block text-white visited:text-white leading-3 transition-all duration-300 ease-in-out hover:text-ssw-red"
                  href={`${pathPrefix}/static-site-generator`}
                >
                  {" "}
                  GitHub
                </a>
              </div>
            </div>
          </div>
        </section>
      </footer>
    </>
  );
};

const getLastDeployTime = () => {
  const lastDeployDuration = moment.duration(Date.now() - buildTimestamp);
  let delta = Math.abs(lastDeployDuration.asMilliseconds()) / 1000;

  const days = Math.floor(delta / 86400);
  delta -= days * 86400;

  var hours = Math.floor(delta / 3600) % 24;
  delta -= hours * 3600;

  var minutes = Math.floor(delta / 60) % 60;
  delta -= minutes * 60;

  return days !== 0 ? `${days} day(s)` : hours !== 0 ? `${hours} hour(s)` : minutes > 1 ? `${minutes} minutes` : "1 minute";
};
