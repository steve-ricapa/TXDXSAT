/** Ambient floating shapes behind the game surface. Purely decorative. */
export function LiveBackground() {
  return (
    <div className="live-blobs" aria-hidden>
      <span className="live-blob h-72 w-72 bg-white" style={{ left: "6%", top: "10%", animationDelay: "0s" }} />
      <span className="live-blob h-52 w-52 bg-fuchsia-300" style={{ right: "8%", top: "18%", animationDelay: "1.6s" }} />
      <span className="live-blob h-64 w-64 bg-sky-300" style={{ left: "38%", bottom: "8%", animationDelay: "3.1s" }} />
      <span className="live-blob h-40 w-40 bg-amber-200" style={{ right: "22%", bottom: "12%", animationDelay: "4.4s" }} />
    </div>
  );
}
