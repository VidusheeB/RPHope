// RP Hope's legal copy, rendered by /policies.
//
// ⚠️ THIS IS LEGAL TEXT — REPRODUCED VERBATIM AS SUPPLIED BY RP HOPE.
// Do not reword, "clean up", summarize, or fix grammar here. Structure only
// (headings / paragraphs / bullets) is expressed via the block types below.
//
// Known inconsistencies in the supplied text, left EXACTLY as provided rather
// than silently corrected — raise with RP Hope before changing:
//   - The Privacy section gives the contact address as "info@rphope.org", while
//     the rest of the site (and the Terms section) uses "information@rphope.org".

export type LegalBlock =
  | { type: "p"; text: string }
  | { type: "h3"; text: string }
  | { type: "ul"; items: string[] };

export type LegalSection = {
  id: string;
  heading: string;
  blocks: LegalBlock[];
};

export const LEGAL_SECTIONS: LegalSection[] = [
  {
    id: "disclaimer",
    heading: "Disclaimer",
    blocks: [
      {
        type: "p",
        text: "All information or advice provided as part of this web site is intended to be general in nature and you should not rely on it in connection with the making of any decision. We are not liable for any action you may take as a result of relying on such information or advice or for any loss or damage suffered by you as a result of you taking this action.",
      },
      {
        type: "p",
        text: "Should any part of this site offer you the opportunity to join in or read from a forum, please be aware that any communications posted on the forum represent the views of the individual who posted such communication and are not to be taken as the views of RP Hope. We accept no responsibility or liability for anything posted on the forum by any user of the forum and you must not use the forum to post, upload, or otherwise transmit information or pictures that are defamatory, a breach of privacy or otherwise unlawful.",
      },
      {
        type: "p",
        text: "We reserve the right to monitor any information transmitted or received through any forum provided. We may at any time review, remove or otherwise block any material posted.",
      },
      {
        type: "p",
        text: "This web site may include links to external web sites. When you follow such links the external web site may appear as a full screen (in which case you will need to use the back button on your browser to return to this web site) or in some cases it may appear within the frame of this web site (in which case you will be able to return to this web site by using the navigation buttons within the frame). Where an external web site appears within the frame of this web site, this is purely for ease of navigation back to this web site and does not indicate any responsibility on our part for the external web site concerned. These links are provided in order to help you find relevant web sites, services and/or products which may be of interest to you quickly and easily. It is your responsibility to decide whether any services and/or products available through any of these web sites are suitable for your purposes.",
      },
    ],
  },
  {
    id: "terms",
    heading: "Terms & Conditions",
    blocks: [
      {
        type: "p",
        text: "By using the website, this serves as the user's agreement to the rules.",
      },
      {
        type: "p",
        text: "This web site contains material including text, logos, photographs, other images, and audio files, which is protected by copyright and/or other intellectual property rights. All copyright and other intellectual property rights in this material are either owned by RP Hope, have been licensed to RP Hope for use as part of this web site, or given credit to the original source of the material. Before using any material on this site, the user/requester must contact RP Hope by email (information@rphope.org) or mail (P.O. Box 1163, Pleasanton, CA 94566).",
      },
      {
        type: "p",
        text: "This web site contains trade marks. Trade marks included on this web site belong to RP Hope or have been licensed to it for use on this web site.",
      },
      { type: "p", text: "Users are not allowed to spam, hack, or steal data." },
      {
        type: "p",
        text: "RP Hope is not responsible for what users post on your site.",
      },
      {
        type: "p",
        text: "RP Hope is not financial and legal responsibility if errors occur on the website or mobile app. If a user finds errors, the user can contact RP Hope by a site submission form, by email (information@rphope.org), or by mail (P.O. Box 1163, Pleasanton, CA 94566).",
      },
      {
        type: "p",
        text: "RP Hope reserves your right to ban or suspend users who break the rules.",
      },
    ],
  },
  {
    id: "privacy",
    heading: "Privacy Policy",
    blocks: [
      { type: "h3", text: "What does this Privacy Notice cover?" },
      {
        type: "p",
        text: "This Privacy Notice provides information regarding the processing of your personal data when using services from RP Hope as:",
      },
      {
        type: "ul",
        items: ["a visitor to the website, or", "a user of the mobile enabled application"],
      },
      {
        type: "p",
        text: "This Privacy Notice explains what personal data are processed about you; why we are processing your personal data and for which purposes; for how long we hold your personal data for; how to access and update your personal data, as well as the options you have regarding your personal data and where to go for further information.",
      },

      { type: "h3", text: "What personal data do we process about you?" },
      { type: "p", text: "Collection of information" },
      { type: "p", text: "This information may be either:" },
      {
        type: "ul",
        items: [
          "Information that you provide to us - when creating an account profile, we will ask for your name and e-mail address, your contact preferences and information necessary for answering any security questions. If you decide to become a member of an offered program or app user we may ask you to provide further personal data necessary for the performance of such services and/or authentication, such as communications preferences and mobile number;",
          "Information that we obtain through your use of our services - we will also collect information about how and where you use or purchase services and products. Such information may include electronic device information, IP addresses, log information, browser type and preferences, location information, online identifiers to enable ‘cookies’ and similar technologies. Your purchase history includes data regarding (i) specific products you buy, (ii) the total amount of your purchases per transaction, (iii) the time and place of the purchases you make and (iv) the payment method you use, including payment methods embedded in the apps (such as mobile payment option);",
          "Information gathered through social media pages - When you communicate with us through a social media page (for example, when you comment on, share or react to a post, upload media, send a personal message or subscribe), we may receive personal data about you such as your user name, profile picture, hometown, email address and gender. We will use any personal data received from social media in accordance with this Privacy Notice.",
        ],
      },

      { type: "h3", text: "Why do we process your personal data?" },
      {
        type: "p",
        text: "The personal data covered by this Privacy Notice are only processed:",
      },
      {
        type: "ul",
        items: [
          "with your explicit consent;",
          "where it is necessary to conclude a transaction with you",
          "where it is necessary for the purposes of the legitimate interests pursued by the company",
          "where it is necessary for us to comply with a legal obligation.",
        ],
      },
      {
        type: "p",
        text: "Where the processing is based on consent, you have the right to withdraw your consent at any time. This will not affect the validity of the processing prior to the withdrawal of consent.",
      },

      { type: "h3", text: "Who is responsible for any personal data collected?" },
      {
        type: "p",
        text: "RP Hope will be responsible for processing your personal data.",
      },

      { type: "h3", text: "For what purposes do we process your personal data?" },
      { type: "p", text: "We process your personal data for the purposes of:" },
      {
        type: "ul",
        items: [
          "provide our products and deliver our services to you;",
          "managing relationships and marketing such as maintaining and promoting contact with you;",
          "account management including account verification (that is, ensuring that only you or someone you have authorized can access your account and information);",
          "performance of and analysis of market surveys and marketing strategies;",
          "promotions and contests or for a secondary purpose where it is closely related, such as:",
          "storing, deleting or anonymizing your personal data;",
          "audits, investigations, dispute resolution or insurance purposes, litigation or defense of claims;",
          "statistical, historical or scientific research; or",
          "legal and/or regulatory compliance.",
        ],
      },

      { type: "h3", text: "Communication and marketing - your choices" },
      {
        type: "p",
        text: "If you have consented to receive communications you may receive offers that are tailored towards your preferences based on the information gathered about you from the various sources described above in order to provide you with better products and increasingly tailored services.",
      },
      {
        type: "p",
        text: "We may send you service updates and notifications without your advance consent only where such updates and/or notifications are necessary for the proper functioning of the apps or other services that you use.",
      },
      {
        type: "p",
        text: "You may receive pertinent offers and communications by different channels and you may update your subscription preferences via your personal profile settings anytime or use the unsubscribe functionality for the different digital channels.",
      },

      { type: "h3", text: "Your rights in relation to your personal data" },
      {
        type: "p",
        text: "We aim to keep our information as accurate as possible. You can request:",
      },
      {
        type: "ul",
        items: [
          "access to your personal data;",
          "correction or deletion of your personal data (but only where it is no longer required for a legitimate business purpose such as completing a retail transaction);",
          "that you no longer receive marketing communications;",
        ],
      },
      {
        type: "p",
        text: "To make any of these requests please email info@rphope.org and submit your request.",
      },

      {
        type: "h3",
        text: "Who can you contact if you have a query, concern or complaint about your personal data?",
      },
      {
        type: "p",
        text: "If you have any issues, queries or complaints regarding the processing of your personal data, please contact us at info@rphope.org.",
      },

      { type: "h3", text: "Cookies and similar technologies" },
      {
        type: "p",
        text: "We use cookies and similar technologies that collect and store information when you visit our website or use our apps. This is to enable us to identify your internet browser and collect data on your use of our website, which pages you visit, the duration of your visits and identify these when you return so that we improve your experience when visiting our website. You can control and manage your cookies preferences by adjusting your browser settings or using the pop-up form (when available) or submitting the request via an email to info@rphope.org and notifying us of your concern.",
      },

      { type: "h3", text: "Who will we share your personal data with?" },
      {
        type: "p",
        text: "Your personal data are exclusively processed for the purposes referred to above and will only be shared on a strict need to know basis with:",
      },
      {
        type: "ul",
        items: [
          "With your consent, authorized third party companies that may supply products and/or services",
          "Authorized service providers involved in mobile payments (such as PayPal, Apple Wallet or Android Pay);",
          "Authorized agents, licensees, service providers, external auditors and/or subcontractors",
          "A competent public authority, government, regulatory, supervisory, investigative or fiscal agency where it is necessary to comply with a legal or regulatory obligation",
        ],
      },

      { type: "h3", text: "How long do we hold your personal data for?" },
      {
        type: "p",
        text: "Personal data processed will be deleted or rendered anonymous (such that it will no longer be possible to identify you);",
      },
      {
        type: "ul",
        items: [
          "every 5 years",
          "without undue delay upon you requesting that your account profile is deleted; or,",
          "after 3 years for all subscribed services from our last interaction with you (that is where you have not used our services for 3 years).",
        ],
      },

      { type: "h3", text: "Changes to this Privacy Notice" },
      { type: "p", text: "This Privacy Notice may be changed over time." },
    ],
  },
];
