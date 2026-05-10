const PrivacyPolicy = () => {
  return (
    <main className="min-h-screen bg-slate-100 py-10 px-4 sm:px-6">
      <article className="mx-auto w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated: May 10, 2026</p>

        <hr className="my-6 border-slate-200" />

        <section className="space-y-3 text-slate-700">
          <h2 className="text-xl font-semibold text-slate-900">Introduction</h2>
          <p>
            This Privacy Policy explains how EMZI Calendar ("we", "our", or "us") collects, uses, and protects
            information when you use our application and services.
          </p>
          <p>By using our services, you agree to the collection and use of information in accordance with this policy.</p>
        </section>

        <section className="mt-6 space-y-3 text-slate-700">
          <h2 className="text-xl font-semibold text-slate-900">Information We Collect</h2>
          <p>We may collect the following information:</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>Name and email address</li>
            <li>Google account information authorized by the user</li>
            <li>Calendar event information created or managed through the application</li>
            <li>Authentication tokens required for Google Calendar integration</li>
            <li>System usage logs and technical information</li>
          </ul>
          <p>We do not collect passwords for your Google account.</p>
        </section>

        <section className="mt-6 space-y-3 text-slate-700">
          <h2 className="text-xl font-semibold text-slate-900">How We Use Information</h2>
          <p>We use the collected information to:</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>Connect your Google Calendar account</li>
            <li>Create, update, and manage calendar events</li>
            <li>Send meeting invitations and reminders</li>
            <li>Improve system functionality and user experience</li>
            <li>Maintain system security and prevent unauthorized access</li>
          </ul>
        </section>

        <section className="mt-6 space-y-3 text-slate-700">
          <h2 className="text-xl font-semibold text-slate-900">Google API Services Disclosure</h2>
          <p>Our application uses Google APIs to access Google Calendar features.</p>
          <p>
            The use of information received from Google APIs adheres to the Google API Services User Data Policy,
            including the Limited Use requirements.
          </p>
          <p>Google user data is only used to provide or improve user-facing features related to calendar functionality.</p>
          <p>We do not sell Google user data to third parties.</p>
        </section>

        <section className="mt-6 space-y-3 text-slate-700">
          <h2 className="text-xl font-semibold text-slate-900">Data Sharing</h2>
          <p>We do not sell, rent, or trade your personal information.</p>
          <p>Information may only be shared:</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>When required by law</li>
            <li>To protect system security and integrity</li>
            <li>With trusted infrastructure or hosting providers necessary to operate the service</li>
          </ul>
        </section>

        <section className="mt-6 space-y-3 text-slate-700">
          <h2 className="text-xl font-semibold text-slate-900">Data Security</h2>
          <p>We implement reasonable security measures to protect your information, including:</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>Encrypted HTTPS connections</li>
            <li>Secure storage of authentication tokens</li>
            <li>Restricted server access</li>
            <li>Access control and monitoring</li>
          </ul>
          <p>However, no internet-based service can be guaranteed to be completely secure.</p>
        </section>

        <section className="mt-6 space-y-3 text-slate-700">
          <h2 className="text-xl font-semibold text-slate-900">Data Retention</h2>
          <p>We retain user information only as long as necessary to provide the service or comply with legal obligations.</p>
          <p>Users may request deletion of their connected Google account data at any time.</p>
        </section>

        <section className="mt-6 space-y-3 text-slate-700">
          <h2 className="text-xl font-semibold text-slate-900">Third-Party Services</h2>
          <p>Our services may integrate with third-party platforms including:</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>Google Calendar API</li>
            <li>Google OAuth Services</li>
            <li>Email service providers</li>
            <li>Cloud hosting providers</li>
          </ul>
          <p>These services may have their own privacy policies.</p>
        </section>

        <section className="mt-6 space-y-3 text-slate-700">
          <h2 className="text-xl font-semibold text-slate-900">User Rights</h2>
          <p>Users may:</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>Request access to their stored information</li>
            <li>Request correction of inaccurate information</li>
            <li>Request deletion of their data</li>
            <li>Disconnect Google account access at any time</li>
          </ul>
        </section>

        <section className="mt-6 space-y-3 text-slate-700">
          <h2 className="text-xl font-semibold text-slate-900">Changes To This Policy</h2>
          <p>We may update this Privacy Policy from time to time.</p>
          <p>Updates will be posted on this page with the updated effective date.</p>
        </section>

        <section className="mt-6 space-y-3 text-slate-700">
          <h2 className="text-xl font-semibold text-slate-900">Contact Information</h2>
          <p>If you have any questions regarding this Privacy Policy, please contact:</p>
          <p>
            Email:{' '}
            <a className="text-blue-700 hover:underline" href="mailto:it@emzi.com.my">
              it@emzi.com.my
            </a>
          </p>
          <p>
            Website:{' '}
            <a
              className="text-blue-700 hover:underline"
              href="https://brain.groobok.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              https://brain.groobok.com
            </a>
          </p>
        </section>
      </article>
    </main>
  );
};

export default PrivacyPolicy;
