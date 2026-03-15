import Head from "next/head";
import Link from "next/link";
import Layout from "@/components/Layout";
import { BASE_URL } from "@/lib/siteUrl";

export default function TermsPage() {
  return (
    <>
      <Head>
        <title>Terms & Conditions — mynextgym.com.au</title>
        <meta
          name="description"
          content="Terms and conditions of use for mynextgym.com.au — Australia's gym and personal trainer directory."
        />
        <link rel="canonical" href={`${BASE_URL}/terms`} />
      </Head>
      <Layout>
        <article className="max-w-3xl mx-auto prose prose-gray prose-sm">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
            Terms &amp; Conditions
          </h1>
          <p className="text-sm text-gray-500 mb-8">
            Gyms &amp; Personal Trainers Directory &middot; Effective March 2026
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8 text-sm text-amber-900">
            <strong>IMPORTANT:</strong> Please read these Terms carefully before using this
            directory. By accessing or using My Next Gym (mynextgym.com.au), you agree to be bound
            by these Terms in full. If you do not agree, you must not use this site.
          </div>

          <Section n="1" title="Introduction & Scope">
            <p>
              My Next Gym (&lsquo;we&rsquo;, &lsquo;us&rsquo;, &lsquo;our&rsquo;) operates
              mynextgym.com.au, an online business directory specialising in listings for gyms,
              fitness centres, and personal trainers (&lsquo;the Directory&rsquo;). These Terms &amp;
              Conditions (&lsquo;Terms&rsquo;) govern your access to and use of the Directory,
              including all content, features, and services offered through it.
            </p>
            <p>
              These Terms apply to all visitors, users, and others who access the Directory, whether
              as a member of the public seeking fitness services (&lsquo;User&rsquo;) or as a
              business or individual submitting or managing a listing (&lsquo;Listing Holder&rsquo;).
            </p>
            <p>
              We reserve the right to amend these Terms at any time. Continued use of the Directory
              following any amendment constitutes your acceptance of the revised Terms. The date of
              last update is shown at the top of this document.
            </p>
          </Section>

          <Section n="2" title="Unverified & Unclaimed Listings">
            <p>
              The Directory may contain listings that have not been submitted, claimed, or verified by
              the business or individual named therein. These are referred to as &lsquo;Unverified
              Listings&rsquo; or &lsquo;Unclaimed Listings&rsquo;.
            </p>
            <div className="bg-gray-100 border border-gray-300 rounded-lg p-4 my-4 text-sm text-gray-700">
              <strong>UNCLAIMED LISTING</strong> — This listing has not been verified or managed by
              the business named. Information may be incomplete, outdated, or inaccurate. Verify all
              details directly with the business before making any decisions.
            </div>
            <p>
              All Unverified Listings are clearly labelled with a visible notice as illustrated above.
              By including such labels, we make no representation as to the accuracy of the
              information displayed. Users should treat Unverified Listings with appropriate caution.
            </p>
            <p>
              The presence of an Unclaimed Listing does not constitute any endorsement,
              recommendation, or affiliation with the named business. If you are the owner of a
              business appearing as an Unclaimed Listing and wish to claim, correct, or remove it,
              please contact us using the details in Section 13.
            </p>
          </Section>

          <Section n="3" title="Listing Content & Accuracy">
            <p>
              Listings on this Directory are compiled from a variety of sources, which may include
              publicly available data, third-party data providers, user submissions, and direct
              submissions from businesses. We do not independently verify every listing.
            </p>
            <p>
              Information displayed in any listing — including but not limited to business name,
              address, telephone number, email address, opening hours, pricing, qualifications,
              accreditations, and services offered — may be:
            </p>
            <ul>
              <li>Inaccurate, incomplete, or out of date</li>
              <li>Based on historical data that has not been refreshed</li>
              <li>
                Submitted by a third party without the knowledge or authorisation of the named
                business
              </li>
              <li>Subject to change by the business at any time without notice to us</li>
            </ul>
            <p>
              Users are strongly encouraged to verify all information directly with the gym, fitness
              centre, or personal trainer before making any booking, purchase, or financial
              commitment.
            </p>
          </Section>

          <Section n="4" title="Limitation of Liability — The Directory">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 my-4 text-sm text-amber-900">
              <strong>NO LIABILITY:</strong> To the maximum extent permitted by applicable Australian
              law, My Next Gym, its directors, employees, contractors, and agents accept no liability
              whatsoever for any loss, damage, injury, or claim of any kind arising from your use of
              this Directory or your reliance on any listing, content, or information found within it.
            </div>
            <p>Without limiting the foregoing, we expressly exclude all liability for:</p>
            <ul>
              <li>
                Any inaccuracy, error, or omission in any listing or other content on the Directory
              </li>
              <li>
                Any loss or damage arising from your reliance on information displayed in an Unclaimed
                or Unverified Listing
              </li>
              <li>
                Any financial loss, including fees paid to a listed gym or personal trainer, arising
                from inaccurate listing information
              </li>
              <li>
                Any personal injury, accident, or harm sustained at a facility listed on the Directory
              </li>
              <li>Any dispute between a User and a listed business or personal trainer</li>
              <li>
                Any failure, interruption, or unavailability of the Directory or any part of it
              </li>
              <li>Any loss of data, profits, revenue, goodwill, or anticipated savings</li>
              <li>Any indirect, consequential, special, or incidental loss of any kind</li>
            </ul>
            <p>
              Nothing in these Terms excludes, restricts, or modifies any consumer guarantee, right,
              or remedy conferred by the Australian Consumer Law (Schedule 2 to the Competition and
              Consumer Act 2010 (Cth)) or any other applicable law that cannot be lawfully excluded.
              Where liability cannot be excluded, our liability is limited to the fullest extent
              permitted by law.
            </p>
          </Section>

          <Section n="5" title="Third-Party Businesses & Personal Trainers">
            <p>
              All gyms, fitness centres, and personal trainers listed in the Directory are independent
              third parties. We are not a party to any contract, arrangement, or relationship between
              a User and any listed business.
            </p>
            <p>
              We are not responsible for and make no representations or warranties regarding:
            </p>
            <ul>
              <li>
                The quality, safety, legality, or suitability of any services offered by listed
                businesses
              </li>
              <li>
                The professional qualifications, certifications, or insurance status of any listed
                personal trainer
              </li>
              <li>
                Whether any listed gym or facility holds current accreditations, licences, or complies
                with applicable health and safety regulations
              </li>
              <li>
                The conduct, acts, or omissions of any listed business, their staff, contractors, or
                agents
              </li>
            </ul>
            <p>
              Users engage with any listed business entirely at their own risk. We strongly recommend
              that Users independently verify the qualifications, insurance, and suitability of any
              personal trainer before commencing any fitness programme, and inspect any gym or fitness
              facility before purchasing any membership or service.
            </p>
          </Section>

          <Section n="6" title="User Obligations">
            <p>By using the Directory, you agree that you will not:</p>
            <ul>
              <li>
                Use the Directory for any unlawful purpose or in any manner that violates applicable
                laws or regulations
              </li>
              <li>
                Attempt to circumvent, disable, or interfere with any security features of the
                Directory
              </li>
              <li>
                Scrape, harvest, or otherwise extract data from the Directory in bulk without our
                prior written consent
              </li>
              <li>Submit false, misleading, or defamatory reviews or content</li>
              <li>
                Impersonate any person or entity or misrepresent your affiliation with any person or
                entity
              </li>
              <li>
                Use automated tools, bots, or scripts to interact with the Directory without our
                prior written consent
              </li>
            </ul>
          </Section>

          <Section n="7" title="Listing Holder Obligations">
            <p>
              If you submit, claim, or manage a listing on the Directory, you warrant and represent
              that:
            </p>
            <ul>
              <li>All information you provide is accurate, complete, and not misleading</li>
              <li>
                You have the authority to submit or manage the listing on behalf of the business named
              </li>
              <li>
                Any qualifications, certifications, or accreditations stated are current, valid, and
                can be evidenced upon request
              </li>
              <li>
                You hold all necessary licences, insurance, and permissions required to operate the
                services described
              </li>
              <li>
                You will keep your listing information up to date and promptly notify us of any
                material changes
              </li>
            </ul>
            <p>
              You agree to indemnify and hold us harmless from any claim, loss, damage, cost, or
              expense (including legal fees) arising from your breach of any of the above warranties,
              or from any inaccurate or misleading information contained in your listing.
            </p>
          </Section>

          <Section n="8" title="Reviews & User-Submitted Content">
            <p>
              Where the Directory permits Users to submit reviews, ratings, or other content, you
              grant us a non-exclusive, royalty-free, worldwide licence to publish, display, and
              moderate that content in connection with the Directory.
            </p>
            <p>
              We do not endorse any user-submitted review or rating and accept no liability for the
              accuracy or fairness of any such content. We reserve the right to remove any content
              that we determine, in our sole discretion, to be defamatory, offensive, false, or
              otherwise inappropriate.
            </p>
            <p>
              Reviewers must have had genuine direct experience with the business they are reviewing.
              Submitting a review on behalf of a competitor, or in exchange for payment or other
              benefit, is prohibited.
            </p>
          </Section>

          <Section n="9" title="Intellectual Property">
            <p>
              All content on the Directory that is not user-submitted or third-party data, including
              the site design, logo, layout, and original descriptive text, is the intellectual
              property of My Next Gym and is protected by applicable Australian copyright and
              intellectual property laws.
            </p>
            <p>
              You may not reproduce, redistribute, or commercially exploit any content from the
              Directory without our prior written permission.
            </p>
          </Section>

          <Section n="10" title="Privacy & Data Protection">
            <p>
              Our collection and use of personal information is governed by our separate{" "}
              <Link href="/privacy" className="text-brand-orange hover:underline">
                Privacy Policy
              </Link>
              , which is incorporated into these Terms by reference. We comply with the Privacy Act
              1988 (Cth) and the Australian Privacy Principles.
            </p>
            <p>
              By using the Directory, you consent to the collection and use of your personal
              information as described in the Privacy Policy.
            </p>
          </Section>

          <Section n="11" title="Disclaimers">
            <p>
              The Directory and all content within it are provided on an &lsquo;as is&rsquo; and
              &lsquo;as available&rsquo; basis without warranties of any kind, whether express or
              implied. To the fullest extent permitted by law, we disclaim all implied warranties
              including but not limited to:
            </p>
            <ul>
              <li>Merchantability and fitness for a particular purpose</li>
              <li>Non-infringement of third-party rights</li>
              <li>
                Accuracy, completeness, timeliness, or reliability of any listing or content
              </li>
              <li>The Directory being free from viruses or other harmful components</li>
            </ul>
            <p>
              We do not warrant that the Directory will be uninterrupted or error-free. Access to the
              Directory may be suspended or restricted without notice for operational or other reasons.
            </p>
          </Section>

          <Section n="12" title="Governing Law & Dispute Resolution">
            <p>
              These Terms are governed by and construed in accordance with the laws of New South
              Wales, Australia. Any dispute arising out of or in connection with these Terms shall be
              subject to the exclusive jurisdiction of the courts of New South Wales, Australia,
              except where the Australian Consumer Law or other mandatory laws provide otherwise.
            </p>
            <p>
              If you have a complaint about the Directory, please contact us in the first instance
              using the details in Section 13. We will endeavour to resolve all complaints promptly
              and fairly.
            </p>
          </Section>

          <Section n="13" title="Contact Us">
            <p>
              For all enquiries, complaints, listing claims, takedown requests, or privacy matters,
              please contact:
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 my-4 text-sm">
              <p className="font-semibold">My Next Gym</p>
              <p>
                Website:{" "}
                <a href="https://mynextgym.com.au" className="text-brand-orange hover:underline">
                  mynextgym.com.au
                </a>
              </p>
              <p>
                Email:{" "}
                <a
                  href="mailto:legal@mynextgym.com.au"
                  className="text-brand-orange hover:underline"
                >
                  legal@mynextgym.com.au
                </a>
              </p>
              <p>Response time: We aim to respond to all enquiries within 5 business days.</p>
            </div>
          </Section>

          <p className="text-xs text-gray-400 mt-12 border-t pt-4">
            Last updated: March 2026 &middot; This document supersedes all previous versions.
            <br />
            &copy; March 2026 My Next Gym &middot; mynextgym.com.au
          </p>
        </article>
      </Layout>
    </>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">
        {n}. {title}
      </h2>
      <div className="space-y-3 text-gray-700 text-sm leading-relaxed">{children}</div>
    </section>
  );
}
