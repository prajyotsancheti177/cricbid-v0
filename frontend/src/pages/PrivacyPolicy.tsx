export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#0E0E15] text-gray-200">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#6B26D9] flex items-center justify-center text-white font-bold text-sm">C</div>
        <span className="font-semibold text-white text-lg">CricBid</span>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Privacy Policy</h1>
          <p className="text-sm text-gray-400 mt-2">Last updated: September 10, 2026</p>
        </div>

        <p className="text-gray-300 leading-relaxed">
          CricBid ("we", "our", or "us") is a cricket auction platform that lets teams, players, and fans
          participate in live cricket player auctions. This Privacy Policy explains what information we collect,
          how we use it, and your rights regarding your data.
        </p>

        <Section title="1. Information We Collect">
          <SubSection title="a) Information you provide">
            <ul className="list-disc pl-5 space-y-1 text-gray-300">
              <li><strong className="text-white">Account registration:</strong> Name, email address, and password when you create a host account.</li>
              <li><strong className="text-white">Player registration:</strong> Name, mobile number, age, skill, category, and optional photo when a player registers for a tournament.</li>
              <li><strong className="text-white">Team registration:</strong> Team name, owner name, owner email, and owner mobile number.</li>
              <li><strong className="text-white">Sign in with Google:</strong> If you sign in with Google, Google sends us your Google account identifier and email address, and tells us whether that email is verified. We store only those. We never receive your Google password, and we do not request access to your contacts, Drive, calendar, or any other Google service.</li>
              <li><strong className="text-white">Player profiles:</strong> The players you save to your account — name, and optionally age, gender, skill, photo and a contact number. One account may hold several players, for example a parent registering two children.</li>
            </ul>
          </SubSection>
          <SubSection title="b) Information collected automatically">
            <ul className="list-disc pl-5 space-y-1 text-gray-300">
              <li><strong className="text-white">Usage data:</strong> Screens viewed, features used, and interaction events — used only to improve the app experience.</li>
              <li><strong className="text-white">Device information:</strong> Device type and operating system version, collected anonymously for compatibility purposes.</li>
              <li><strong className="text-white">IP address:</strong> Used for geographic region detection to display relevant tournaments. Not stored beyond the session.</li>
            </ul>
          </SubSection>
        </Section>

        <Section title="2. How We Use Your Information">
          <ul className="list-disc pl-5 space-y-1 text-gray-300">
            <li>To display tournament, player, and team information within the app.</li>
            <li>To send WhatsApp notifications about auction results (player sold/unsold status, team updates) — only when explicitly configured by the tournament host.</li>
            <li>To allow team owners and players to view their auction results.</li>
            <li>To improve app performance and fix issues using anonymous usage analytics.</li>
            <li>We do <strong className="text-white">not</strong> sell, rent, or share your personal data with third parties for marketing purposes.</li>
          </ul>
        </Section>

        <Section title="3. Sign in with Google">
          <p className="text-gray-300 leading-relaxed">
            Signing in is optional. You can register for a tournament without an account; signing in
            simply saves your details so you do not have to type them again next time.
          </p>
          <ul className="list-disc pl-5 space-y-1 text-gray-300 mt-3">
            <li><strong className="text-white">What we receive:</strong> your Google account identifier and email address, and whether Google has verified that email.</li>
            <li><strong className="text-white">What we store:</strong> only those two values, plus the players you choose to save. We do not store your name or profile picture from Google.</li>
            <li><strong className="text-white">What we use it for:</strong> recognising you when you return, and nothing else. We do not email you marketing, and we do not share your email with tournament hosts unless you enter it on a registration form yourself.</li>
            <li><strong className="text-white">Revoking access:</strong> you can disconnect CricBid at any time from your{" "}
              <a href="https://myaccount.google.com/permissions" className="text-[#6B26D9] underline" target="_blank" rel="noreferrer">Google account permissions</a>{" "}
              page. To delete the account and its saved players from CricBid, use{" "}
              <a href="/delete-account" className="text-[#6B26D9] underline">Delete account</a> or email us.</li>
          </ul>
          <p className="text-gray-300 leading-relaxed mt-3">
            CricBid's use of information received from Google APIs adheres to the{" "}
            <a href="https://developers.google.com/terms/api-services-user-data-policy" className="text-[#6B26D9] underline" target="_blank" rel="noreferrer">
              Google API Services User Data Policy
            </a>, including the Limited Use requirements.
          </p>
        </Section>

        <Section title="4. WhatsApp Notifications">
          <p className="text-gray-300 leading-relaxed">
            If a tournament host enables WhatsApp notifications, we may send messages to registered mobile
            numbers using Meta's WhatsApp Business API. These messages include auction results, team updates,
            and reminders. Message frequency depends on auction activity. Standard messaging rates may apply.
            You can contact the tournament organiser to opt out of notifications for a specific tournament.
          </p>
        </Section>

        <Section title="5. Data Storage and Security">
          <ul className="list-disc pl-5 space-y-1 text-gray-300">
            <li>Data is stored on secure cloud servers (Supabase/PostgreSQL) hosted in India and Japan.</li>
            <li>All data in transit is encrypted using TLS/HTTPS.</li>
            <li>Player accounts have no password at all — signing in is handled by Google. Tournament host passwords are hashed and never stored in plain text.</li>
            <li>Sign-in sessions expire after 90 days.</li>
            <li>We retain tournament data for the duration of the tournament and up to 12 months thereafter.</li>
          </ul>
        </Section>

        <Section title="6. Data Sharing">
          <p className="text-gray-300 leading-relaxed">
            We do not sell your personal information. We share data only with:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-gray-300 mt-2">
            <li><strong className="text-white">Meta (WhatsApp Business API):</strong> Mobile numbers are used to send auction notifications. Meta's own privacy policy applies to message delivery.</li>
            <li><strong className="text-white">Google (Sign in with Google):</strong> If you choose to sign in with Google, Google handles the sign-in and tells us who you are. Google's own privacy policy applies to that step. We send Google no information about you.</li>
            <li><strong className="text-white">Tournament hosts:</strong> Player and team data entered for a tournament is visible to the tournament's host/organiser.</li>
            <li><strong className="text-white">Legal requirements:</strong> If required by law or to protect user safety.</li>
          </ul>
        </Section>

        <Section title="7. Your Rights">
          <ul className="list-disc pl-5 space-y-1 text-gray-300">
            <li><strong className="text-white">Access:</strong> You can request a copy of your personal data.</li>
            <li><strong className="text-white">Correction:</strong> You can ask us to correct inaccurate data.</li>
            <li><strong className="text-white">Deletion:</strong> You can request deletion of your account and associated personal data.</li>
            <li><strong className="text-white">Opt-out:</strong> You can ask to be removed from WhatsApp notifications by contacting us.</li>
          </ul>
          <p className="text-gray-300 mt-3">
            To exercise these rights, email us at{" "}
            <a href="mailto:prajyotsancheti177@gmail.com" className="text-[#6B26D9] underline">
              prajyotsancheti177@gmail.com
            </a>
            .
          </p>
        </Section>

        <Section title="8. Children's Privacy">
          <p className="text-gray-300 leading-relaxed">
            CricBid is not directed at children, and children should not create accounts themselves.
            Youth tournaments are common on CricBid, and where a player is a minor we expect a parent or
            guardian to hold the account and to enter that child's details on their behalf. If you believe
            a child has provided us personal information directly, please contact us and we will delete it
            promptly.
          </p>
        </Section>

        <Section title="9. Third-Party Links">
          <p className="text-gray-300 leading-relaxed">
            The app may display links to external websites or services (e.g. WhatsApp). We are not responsible
            for the privacy practices of those third parties.
          </p>
        </Section>

        <Section title="10. Changes to This Policy">
          <p className="text-gray-300 leading-relaxed">
            We may update this Privacy Policy occasionally. We will notify users of significant changes
            through the app or via email. Continued use of the app after changes constitutes acceptance
            of the updated policy.
          </p>
        </Section>

        <Section title="11. Contact Us">
          <p className="text-gray-300 leading-relaxed">
            If you have any questions about this Privacy Policy, please contact us:
          </p>
          <div className="mt-3 p-4 bg-white/5 rounded-lg border border-white/10 space-y-1 text-gray-300 text-sm">
            <p><strong className="text-white">CricBid</strong></p>
            <p>Email: <a href="mailto:prajyotsancheti177@gmail.com" className="text-[#6B26D9] underline">prajyotsancheti177@gmail.com</a></p>
            <p>Website: <a href="https://cricbid.online" className="text-[#6B26D9] underline">https://cricbid.online</a></p>
          </div>
        </Section>

        <p className="text-xs text-gray-500 pt-4 border-t border-white/10">
          © 2026 CricBid. All rights reserved.
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {children}
    </div>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-300">{title}</h3>
      {children}
    </div>
  );
}
