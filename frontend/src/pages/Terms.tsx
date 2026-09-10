export default function Terms() {
  return (
    <div className="min-h-screen bg-[#0E0E15] text-gray-200">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#6B26D9] flex items-center justify-center text-white font-bold text-sm">C</div>
        <span className="font-semibold text-white text-lg">CricBid</span>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Terms of Service</h1>
          <p className="text-sm text-gray-400 mt-2">Last updated: September 10, 2026</p>
        </div>

        <p className="text-gray-300 leading-relaxed">
          These terms govern your use of CricBid ("we", "our", or "us"), a platform at{" "}
          <a href="https://cricbid.online" className="text-[#6B26D9] underline">cricbid.online</a>{" "}
          that lets organisers run cricket tournaments — collecting player and team registrations,
          holding a live player auction, scheduling matches and scoring them. By using CricBid you
          agree to these terms.
        </p>

        <Section title="1. What CricBid Is">
          <p className="text-gray-300 leading-relaxed">
            CricBid is software that tournament organisers use to run their own tournaments. We provide
            the tools; the organiser runs the event. We are not a party to any tournament, team selection,
            entry fee, prize or dispute between an organiser, a team owner and a player.
          </p>
        </Section>

        <Section title="2. No Real-Money Betting or Gambling">
          <p className="text-gray-300 leading-relaxed">
            Auction bids on CricBid are placed in <strong className="text-white">points</strong>, a
            notional team budget set by the organiser. They are not money, they have no cash value, and
            they cannot be bought, sold, redeemed or withdrawn. CricBid does not process wagers, does not
            handle prize money, and is not a betting, gambling or fantasy-sports service.
          </p>
          <p className="text-gray-300 leading-relaxed mt-3">
            Where a tournament charges a registration fee, that fee is collected by the organiser directly
            — typically by UPI — and CricBid neither receives nor holds it. Any question about a fee,
            refund or prize is between you and the organiser.
          </p>
        </Section>

        <Section title="3. Accounts">
          <ul className="list-disc pl-5 space-y-1 text-gray-300">
            <li>Signing in is optional. You can register for a tournament without an account.</li>
            <li>Player sign-in uses Google. There is no password to set or remember.</li>
            <li>An account may hold several players — a parent may register more than one child from a single sign-in. You are responsible for having the right to enter details for anyone you add.</li>
            <li>Tournament host accounts are created by us or by an existing administrator. Keep your credentials to yourself; you are responsible for activity under your account.</li>
            <li>You may delete your account and its saved players at any time from{" "}
              <a href="/delete-account" className="text-[#6B26D9] underline">Delete account</a>.</li>
          </ul>
        </Section>

        <Section title="4. If You Are an Organiser">
          <p className="text-gray-300 leading-relaxed">
            Running a tournament on CricBid means you handle other people's personal data, so:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-gray-300 mt-2">
            <li>Collect only what your tournament actually needs, and use it only to run that tournament.</li>
            <li>Do not export, sell or reuse player contact details for anything else.</li>
            <li>Send WhatsApp notifications only to people who registered for your tournament, and honour any request to stop.</li>
            <li>Auction results you publish — who was sold, to whom, for how many points — are your responsibility and are visible to anyone with the tournament link.</li>
            <li>You remain responsible for entry fees, prizes, eligibility, fair play and any dispute arising from your event.</li>
          </ul>
        </Section>

        <Section title="5. Acceptable Use">
          <ul className="list-disc pl-5 space-y-1 text-gray-300">
            <li>Do not register someone else's details without their permission, or impersonate anyone.</li>
            <li>Do not upload unlawful, offensive or infringing content, including photographs you have no right to use.</li>
            <li>Do not attempt to break, overload, scrape or gain unauthorised access to the platform or to another organiser's tournament data.</li>
            <li>Do not use CricBid for betting, gambling or any unlawful purpose.</li>
          </ul>
          <p className="text-gray-300 leading-relaxed mt-3">
            We may suspend or remove an account, a tournament, or any content that breaches these terms.
          </p>
        </Section>

        <Section title="6. Your Content">
          <p className="text-gray-300 leading-relaxed">
            You keep ownership of what you upload — names, photographs, team logos and tournament details.
            You grant us permission to store and display that content for the purpose of operating the
            platform and showing your tournament to its participants and viewers. Deleting it from CricBid
            withdraws that permission going forward.
          </p>
        </Section>

        <Section title="7. Availability">
          <p className="text-gray-300 leading-relaxed">
            CricBid is provided as-is and as-available. We do not guarantee uninterrupted service. Live
            auctions depend on your internet connection and on third-party services we do not control,
            including hosting, WhatsApp delivery and Google sign-in. We may change, suspend or discontinue
            features. We will try to give notice of significant changes, but cannot always do so.
          </p>
        </Section>

        <Section title="8. Limitation of Liability">
          <p className="text-gray-300 leading-relaxed">
            To the extent permitted by law, CricBid is not liable for indirect or consequential loss, or
            for loss of profit, data, goodwill or opportunity, arising from your use of the platform —
            including an interrupted auction, an undelivered notification, or a decision taken on the basis
            of information shown in the app. Nothing in these terms limits liability that cannot lawfully
            be limited.
          </p>
        </Section>

        <Section title="9. Privacy">
          <p className="text-gray-300 leading-relaxed">
            Our <a href="/privacy-policy" className="text-[#6B26D9] underline">Privacy Policy</a> explains
            what we collect, why, and how to have it removed. It forms part of these terms.
          </p>
        </Section>

        <Section title="10. Changes to These Terms">
          <p className="text-gray-300 leading-relaxed">
            We may update these terms from time to time. The date at the top shows when they last changed.
            Continuing to use CricBid after a change means you accept the updated terms.
          </p>
        </Section>

        <Section title="11. Governing Law">
          <p className="text-gray-300 leading-relaxed">
            These terms are governed by the laws of India, and the courts of Chhatrapati Sambhajinagar
            (Aurangabad), Maharashtra have exclusive jurisdiction over any dispute.
          </p>
        </Section>

        <Section title="12. Contact Us">
          <p className="text-gray-300 leading-relaxed">
            Questions about these terms:
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
