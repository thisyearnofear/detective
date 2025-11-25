export default function BottomLinks() {
  const links = [
    {
      label: "Arbitrum",
      href: "https://highlight.xyz/tools/collections/69263040ce236da5c5958f71/manage?txnId=txn-1764110071330"
    },
    {
      label: "Paragraph",
      href: "http://paragraph.xyz/@papajams.eth/detective"
    },
    {
      label: "Monad",
      href: "https://clanker.world/clanker/0x991a6c1674f5FF82653D322E11Eb34185F587b07"
    }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-center pb-8 pointer-events-none">
      <div className="flex gap-6 pointer-events-auto">
        {links.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium uppercase tracking-wider text-white/60 hover:text-white transition-colors duration-200 border-b border-white/20 hover:border-white/60 pb-1"
          >
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
}
