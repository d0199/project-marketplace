import Head from "next/head";
import Link from "next/link";
import Layout from "@/components/Layout";
import { BASE_URL } from "@/lib/siteUrl";

export default function PrivacyPage() {
  return (
    <>
      <Head>
        <title>Privacy Policy — mynextgym.com.au</title>
        <meta
          name="description"
          content="Privacy policy for mynextgym.com.au — how we collect, use, and protect your personal information."
        />
        <link rel="canonical" href={`${BASE_URL}/privacy`} />
      </Head>
      <Layout>
        <article className="max-w-3xl mx-auto prose prose-gray prose-sm">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-sm text-gray-500 mb-8">
            Gyms &amp; Personal Trainers Directory &middot; Effective March 2026
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8 text-sm text-blue-900">
            <strong>YOUR PRIVACY:</strong> My Next Gym is committed to protecting your personal
            information in accordance with the Privacy Act 1988 (Cth) and the Australian Privacy
            Principles (&lsquo;APPs&rsquo;). This Privacy Policy explains what information we
            collect, why we collect it, how we use and protect it, and your rights in relation to it.
          </div>

          <Section n="1" title="About This Policy">
            <p>
              This Privacy Policy applies to My Next Gym (&lsquo;we&rsquo;, &lsquo;us&rsquo;,
              &lsquo;our&rsquo;), which operates the online fitness business directory at
              mynextgym.com.au (&lsquo;the Directory&rsquo;).
            </p>
            <p>
              This Policy applies to all personal information we collect from users of the Directory
              (&lsquo;Users&rsquo;), businesses and individuals managing listings (&lsquo;Listing
              Holders&rsquo;), and any other individuals who interact with us.
            </p>
            <p>
              By using the Directory or providing your personal information to us, you consent to the
              collection, use, and disclosure of your information in accordance with this Policy. If
              you do not agree with this Policy, you should not use the Directory.
            </p>
            <p>
              We may update this Policy from time to time. The current version is always available at{" "}
              <Link href="/privacy" className="text-brand-orange hover:underline">
                mynextgym.com.au/privacy
              </Link>
              . We will notify you of material changes by posting a notice on the Directory.
            </p>
          </Section>

          <Section n="2" title="What Information We Collect">
            <p>We may collect the following categories of personal information:</p>

            <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-2">
              From Users (members of the public using the Directory):
            </h3>
            <ul>
              <li>
                Name and contact details (if you submit a review, enquiry, or create an account)
              </li>
              <li>
                Email address (for account registration, newsletters, or notifications)
              </li>
              <li>
                Location data (suburb, postcode, or general region — to provide localised search
                results)
              </li>
              <li>
                Device and browser information, IP address, and usage data (collected automatically
                via cookies and analytics tools)
              </li>
              <li>Any other information you voluntarily provide when contacting us</li>
            </ul>

            <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-2">
              From Listing Holders (gyms, fitness centres, personal trainers):
            </h3>
            <ul>
              <li>Business name, ABN, and registered address</li>
              <li>Contact person name, email address, and phone number</li>
              <li>Business description, services, pricing, and operating hours</li>
              <li>Qualifications, certifications, and accreditation details</li>
              <li>Profile photos or images (where uploaded)</li>
              <li>
                Billing and payment details (processed securely by our payment provider — we do not
                store full card details)
              </li>
            </ul>
            <p>
              We do not intentionally collect sensitive information (as defined in the Privacy Act)
              such as health, biometric, racial, or religious information. If you believe we have
              inadvertently collected sensitive information, please contact us immediately.
            </p>
          </Section>

          <Section n="3" title="How We Collect Information">
            <p>We collect personal information in the following ways:</p>
            <ul>
              <li>
                Directly from you when you create an account, submit or claim a listing, complete a
                contact form, submit a review, or otherwise interact with the Directory
              </li>
              <li>
                Automatically when you visit the Directory, via cookies, web beacons, analytics tools
                (including Google Analytics), and server logs
              </li>
              <li>
                From publicly available sources, such as business websites, ASIC registers, or
                publicly listed contact information, for the purpose of populating Unverified Listings
              </li>
              <li>From third-party data providers who supply business listing data</li>
              <li>
                From other users, where they submit information about a business in a review or
                listing submission
              </li>
            </ul>
          </Section>

          <Section n="4" title="Why We Collect & How We Use Your Information">
            <p>
              We collect and use personal information only for purposes that are directly related to
              our functions and activities. These include:
            </p>
            <ul>
              <li>Providing, operating, and improving the Directory and its features</li>
              <li>
                Displaying business listings and enabling Users to find gyms and personal trainers
              </li>
              <li>Creating and managing User accounts and Listing Holder accounts</li>
              <li>Responding to enquiries, complaints, and support requests</li>
              <li>Processing listing subscription payments</li>
              <li>
                Sending transactional communications (account confirmations, listing updates, payment
                receipts)
              </li>
              <li>
                Sending marketing communications, including newsletters and promotional offers — only
                where you have opted in or we are otherwise permitted to do so under applicable law
              </li>
              <li>
                Conducting analytics to understand how the Directory is used and to improve our
                services
              </li>
              <li>Detecting and preventing fraud, abuse, and security incidents</li>
              <li>Complying with our legal obligations</li>
            </ul>
            <p>
              We will not use your personal information for any purpose that is incompatible with the
              purpose for which it was collected, unless you consent or we are required or authorised
              by law to do so.
            </p>
          </Section>

          <Section n="5" title="Disclosure of Personal Information">
            <p>
              We do not sell, rent, or trade your personal information to third parties. We may
              disclose your personal information in the following limited circumstances:
            </p>
            <ul>
              <li>
                To service providers and contractors who assist us in operating the Directory (for
                example, web hosting providers, email service providers, analytics providers, payment
                processors) — these parties are bound by confidentiality obligations and may only use
                your information to provide services to us
              </li>
              <li>
                To other Users, to the extent that your listing information is publicly displayed on
                the Directory
              </li>
              <li>
                To regulatory authorities, law enforcement, or courts where required or authorised by
                law
              </li>
              <li>
                In connection with a business sale, merger, or acquisition — where we will notify
                affected individuals
              </li>
              <li>With your express consent</li>
            </ul>
            <p>
              Where we disclose personal information to overseas recipients (for example, cloud
              hosting providers), we take reasonable steps to ensure those recipients handle your
              information consistently with the Australian Privacy Principles. By using the Directory,
              you consent to such overseas disclosure where necessary.
            </p>
          </Section>

          <Section n="6" title="Cookies & Tracking Technologies">
            <p>
              We use cookies, web beacons, and similar tracking technologies to enhance your
              experience on the Directory. Cookies are small text files placed on your device.
            </p>
            <p>We use the following types of cookies:</p>
            <ul>
              <li>
                <strong>Essential cookies</strong> — required for the Directory to function correctly
                (for example, session management and security)
              </li>
              <li>
                <strong>Analytics cookies</strong> — to understand how Users interact with the
                Directory (for example, Google Analytics)
              </li>
              <li>
                <strong>Preference cookies</strong> — to remember your settings and preferences
              </li>
              <li>
                <strong>Marketing cookies</strong> — to deliver relevant advertising, where applicable
              </li>
            </ul>
            <p>
              You can control or disable cookies through your browser settings. Note that disabling
              certain cookies may affect the functionality of the Directory. By continuing to use the
              Directory after being notified of our cookie use, you consent to our use of cookies as
              described.
            </p>
          </Section>

          <Section n="7" title="Data Security">
            <p>
              We take reasonable steps to protect the personal information we hold from misuse,
              interference, loss, and from unauthorised access, modification, or disclosure. Our
              security measures include:
            </p>
            <ul>
              <li>Encryption of data in transit using industry-standard TLS/SSL protocols</li>
              <li>Secure storage of data with access controls and authentication</li>
              <li>Regular security assessments and updates</li>
              <li>Restricting access to personal information to authorised personnel only</li>
            </ul>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 my-4 text-sm text-amber-900">
              <strong>IMPORTANT:</strong> No method of transmission over the internet or electronic
              storage is completely secure. While we strive to protect your personal information, we
              cannot guarantee absolute security. You transmit information to us at your own risk.
            </div>
            <p>
              In the event of a data breach that is likely to result in serious harm, we will notify
              affected individuals and the Office of the Australian Information Commissioner (OAIC) as
              required by the Notifiable Data Breaches scheme under the Privacy Act.
            </p>
          </Section>

          <Section n="8" title="Retention of Personal Information">
            <p>
              We retain personal information only for as long as necessary to fulfil the purposes for
              which it was collected, or as required by law. In general:
            </p>
            <ul>
              <li>
                Account and listing information is retained for the duration of your account or
                listing, and for a reasonable period thereafter for legal and administrative purposes
              </li>
              <li>
                Review and user-generated content is retained until removed at your request or at our
                discretion
              </li>
              <li>Analytics and log data is typically retained for up to 26 months</li>
              <li>
                Financial and transaction records are retained for a minimum of 7 years as required by
                Australian law
              </li>
            </ul>
            <p>
              When personal information is no longer required, we take reasonable steps to destroy it
              or ensure it is de-identified.
            </p>
          </Section>

          <Section n="9" title="Your Rights & Accessing Your Information">
            <p>
              Under the Australian Privacy Principles, you have the following rights in relation to
              your personal information:
            </p>
            <ul>
              <li>
                <strong>Access</strong> — you may request access to the personal information we hold
                about you
              </li>
              <li>
                <strong>Correction</strong> — you may request that we correct personal information
                that is inaccurate, out of date, incomplete, or misleading
              </li>
              <li>
                <strong>Opt-out of marketing</strong> — you may unsubscribe from marketing
                communications at any time using the unsubscribe link in any email or by contacting us
              </li>
              <li>
                <strong>Listing removal</strong> — if your personal information appears in an
                Unverified Listing, you may request its removal or correction
              </li>
              <li>
                <strong>Complaint</strong> — if you believe we have breached the APPs, you may lodge
                a complaint with us or with the OAIC
              </li>
            </ul>
            <p>
              To exercise any of these rights, please contact us using the details in Section 12. We
              will respond to all requests within 30 days. In some circumstances, we may be unable to
              provide access or require verification of your identity before doing so.
            </p>
          </Section>

          <Section n="10" title="Children's Privacy">
            <p>
              The Directory is not directed at children under the age of 15. We do not knowingly
              collect personal information from children under 15. If we become aware that we have
              collected personal information from a child under 15 without verified parental consent,
              we will take steps to delete that information promptly.
            </p>
            <p>
              If you are a parent or guardian and believe your child has provided us with personal
              information, please contact us immediately.
            </p>
          </Section>

          <Section n="11" title="Links to Third-Party Sites">
            <p>
              The Directory may contain links to third-party websites, including the websites of
              listed gyms and personal trainers. We are not responsible for the privacy practices or
              content of those sites. We encourage you to read the privacy policies of any third-party
              sites you visit.
            </p>
          </Section>

          <Section n="12" title="Complaints & Contact">
            <p>
              If you have any questions about this Privacy Policy, wish to access or correct your
              personal information, or wish to make a privacy complaint, please contact our Privacy
              Officer:
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 my-4 text-sm">
              <p className="font-semibold">Privacy Officer — My Next Gym</p>
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
              <p>
                We will acknowledge your complaint within 5 business days and aim to resolve it within
                30 days.
              </p>
            </div>
            <p>
              If you are not satisfied with our response, you may escalate your complaint to the
              Office of the Australian Information Commissioner (OAIC):
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 my-4 text-sm">
              <p className="font-semibold">
                Office of the Australian Information Commissioner (OAIC)
              </p>
              <p>
                Website:{" "}
                <a
                  href="https://www.oaic.gov.au"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-orange hover:underline"
                >
                  www.oaic.gov.au
                </a>
              </p>
              <p>Phone: 1300 363 992</p>
              <p>GPO Box 5218, Sydney NSW 2001</p>
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
