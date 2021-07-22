import React from 'react';
import preval from 'preval.macro';
import moment from 'moment';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHeart } from '@fortawesome/free-solid-svg-icons';
import {
  faFacebook,
  faGithub,
  faInstagram,
  faLinkedin,
  faTwitter,
  faWeixin,
  faYoutube,
} from '@fortawesome/free-brands-svg-icons';

const buildTimestamp = preval`module.exports = new Date().getTime();`;

const Footer = () => {
  return (
    <>
      <div className="py-2 text-center bg-grey-translucent text-sm">
        <section className="main-container">
          We <FontAwesomeIcon icon={faHeart} className="text-ssw-red" /> open
          source. This page is on{' '}
          <a
            className="action-button-label"
            href="https://github.com/SSWConsulting/SSW.Rules"
          >
            GitHub <FontAwesomeIcon icon={faGithub} />
          </a>
        </section>
      </div>
      <footer className="bg-black py-6 md:py-4 lg:py-2">
        <section className="main-container">
          <div className="xl:mx-6">
            <div className="mx-6 flex flex-col-reverse md:flex-row justify-between align-middle leading-6">
              <div className="py-2">
                Copyright © SSW 1990 - {new Date().getFullYear()}. All Rights
                Reserved.
              </div>
              <div className="w-full md:w-3/6 md:text-right py-2">
                <a
                  className="footer-link"
                  href="https://github.com/SSWConsulting/SSW.Rules/issues"
                >
                  FEEDBACK TO SSW
                </a>
                <span className="px-2">|</span>
                <a
                  className="footer-link"
                  href="https://www.ssw.com.au/ssw/Standards/Forms/ConsultingOrderTermsConditions.aspx"
                >
                  TERMS AND CONDITIONS
                </a>
                <span className="px-2">|</span>
                <div className="inline-flex flex-row-reverse justify-end flex-nowrap">
                  <a
                    className="unstyled social-media-icon"
                    id="youtube-icon"
                    title="SSW on YouTube"
                    href="https://www.youtube.com/user/sswtechtalks/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FontAwesomeIcon icon={faYoutube} size="lg" />
                  </a>
                  <a
                    className="unstyled social-media-icon"
                    id="linkedin-icon"
                    title="SSW on LinkedIn"
                    href="https://www.linkedin.com/company/ssw/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FontAwesomeIcon icon={faLinkedin} size="lg" />
                  </a>
                  <a
                    className="unstyled social-media-icon"
                    id="twitter-icon"
                    title="SSW on Twitter"
                    href="https://twitter.com/SSW_TV"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FontAwesomeIcon icon={faTwitter} size="lg" />
                  </a>
                  <a
                    className="unstyled social-media-icon"
                    id="instagram-icon"
                    title="SSW on Instagram"
                    href="https://www.instagram.com/ssw_tv"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FontAwesomeIcon icon={faInstagram} size="lg" />
                  </a>
                  <a
                    className="unstyled social-media-icon"
                    id="facebook-icon"
                    title="SSW on Facebook"
                    href="https://www.facebook.com/SSW.page"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FontAwesomeIcon icon={faFacebook} size="lg" />
                  </a>
                  <a
                    className="unstyled social-media-icon"
                    id="wechat-icon"
                    title="SSW on WeChat"
                    href="https://mp.weixin.qq.com/s/jL4zEmzWM5VSTRu9DUW6-Q"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FontAwesomeIcon icon={faWeixin} size="lg" />
                    <span id="qr-code">
                      <img
                        src="http://www.ssw.com.au/ssw/Images/QRcode.jpg"
                        alt="SSW QR Code"
                        width="100"
                        title="SSW WeChat QR Code"
                        height="100"
                      />
                    </span>
                  </a>
                </div>
              </div>
              {/* Copyright © SSW 1990 - {new Date().getFullYear()}. All Rights Reserved. */}
            </div>
            <hr className="border-gray-800 my-2"></hr>
            <div className="flex flex-col md:flex-row justify-between mx-6">
              <div className="py-2">
                Our website is under{' '}
                <a
                  className="footer-link"
                  href="https://www.ssw.com.au/rules/rules-to-better-websites-deployment"
                >
                  CONSTANT CONTINUOUS DEPLOYMENT
                </a>
                . Last deployed {getLastDeployTime()} ago (Build #{' '}
                <a
                  className="footer-link"
                  href="https://github.com/SSWConsulting/SSW.Rules/releases/latest"
                >
                  {process.env.VERSION_DEPLOYED}
                </a>
                )
              </div>
              <div className="md:text-right py-2">
                Powered by{' '}
                <a
                  className="footer-link"
                  href="https://www.ssw.com.au/rules/rules-to-better-azure"
                >
                  Azure
                </a>{' '}
                and{' '}
                <a
                  className="footer-link"
                  href="https://www.ssw.com.au/rules/static-site-generator"
                >
                  {' '}
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
  let delta = Math.abs(lastDeployDuration) / 1000;

  const days = Math.floor(delta / 86400);
  delta -= days * 86400;

  var hours = Math.floor(delta / 3600) % 24;
  delta -= hours * 3600;

  var minutes = Math.floor(delta / 60) % 60;
  delta -= minutes * 60;

  return days !== 0
    ? `${days} day(s)`
    : ' ' + hours !== 0
    ? `${hours} hour(s)`
    : ' ' + minutes > 1
    ? `${minutes} minutes`
    : '1 minute';
};

Footer.propTypes = {};

export default Footer;
