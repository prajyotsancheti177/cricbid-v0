export default function DeleteAccount() {
  return (
    <div className="min-h-screen bg-[#0E0E15] text-gray-200">
      <div className="border-b border-white/10 px-6 py-5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#6B26D9] flex items-center justify-center text-white font-bold text-sm">C</div>
        <span className="font-semibold text-white text-lg">CricBid</span>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-12 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Request Account Deletion</h1>
          <p className="text-sm text-gray-400 mt-2">CricBid — Data Deletion Policy</p>
        </div>

        <p className="text-gray-300 leading-relaxed">
          You can request the deletion of your CricBid account and all associated personal data at any time.
          We will process your request within <strong className="text-white">7 business days</strong>.
        </p>

        <div className="p-5 bg-white/5 border border-white/10 rounded-xl space-y-3">
          <h2 className="text-white font-semibold">How to request deletion</h2>
          <p className="text-gray-300 text-sm leading-relaxed">
            Send an email to the address below from the email address registered to your account.
            Include your name and the email you registered with.
          </p>
          <a
            href="mailto:prajyotsancheti177@gmail.com?subject=CricBid%20Account%20Deletion%20Request&body=Hi%2C%20I%20would%20like%20to%20request%20deletion%20of%20my%20CricBid%20account%20and%20all%20associated%20data.%0A%0ARegistered%20email%3A%20%5Byour%20email%5D%0AName%3A%20%5Byour%20name%5D"
            className="inline-flex items-center gap-2 px-4 py-3 bg-[#6B26D9] hover:bg-[#5a1fc7] text-white rounded-lg font-semibold transition text-sm"
          >
            Email us to delete your account →
          </a>
        </div>

        <div className="space-y-4">
          <h2 className="text-white font-semibold">What gets deleted</h2>
          <ul className="list-disc pl-5 space-y-1 text-gray-300 text-sm">
            <li>Your account credentials (email and password)</li>
            <li>Your profile information (name)</li>
            <li>Any tournament data you created as a host</li>
            <li>Your activity and usage logs</li>
          </ul>

          <h2 className="text-white font-semibold pt-2">What may be retained</h2>
          <ul className="list-disc pl-5 space-y-1 text-gray-300 text-sm">
            <li>
              <strong className="text-white">Player / team records</strong> — if you registered as a player or team owner in a tournament,
              your name and auction results may be retained by the tournament organiser for up to 12 months
              for record-keeping purposes.
            </li>
            <li>
              <strong className="text-white">Transaction logs</strong> — anonymised auction event logs may be retained for up to 12 months.
            </li>
          </ul>
        </div>

        <div className="p-4 bg-white/5 border border-white/10 rounded-xl text-sm text-gray-300 space-y-1">
          <p className="text-white font-semibold">Contact</p>
          <p>Email: <a href="mailto:prajyotsancheti177@gmail.com" className="text-[#6B26D9] underline">prajyotsancheti177@gmail.com</a></p>
          <p>Website: <a href="https://cricbid.online" className="text-[#6B26D9] underline">https://cricbid.online</a></p>
        </div>

        <p className="text-xs text-gray-500 pt-4 border-t border-white/10">
          © 2026 CricBid. All rights reserved.
        </p>
      </div>
    </div>
  );
}
