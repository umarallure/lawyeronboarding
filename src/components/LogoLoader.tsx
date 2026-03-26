import { motion } from "framer-motion";

type LogoLoaderProps = {
  /** Size of the whole loader in px. Default 80. */
  size?: number;
  /** Optional label rendered below. */
  label?: string;
  /** Fill the full viewport including nav/sidebar (auth screens only). */
  fullscreen?: boolean;
  /** Fill the page content area only — keeps sidebar & header visible. */
  page?: boolean;
};

const LogoLoader = ({ size = 80, label, fullscreen = false, page = false }: LogoLoaderProps) => {
  const ring = size + 24;

  const content = (
    <div className="flex flex-col items-center gap-4">
      {/* Spinning ring + pulsing logo */}
      <div className="relative" style={{ width: ring, height: ring }}>
        {/* Outer spinning arc */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "conic-gradient(from 0deg, transparent 70%, #c2410c 100%)",
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
        />

        {/* White gap ring to separate arc from logo */}
        <div
          className="absolute rounded-full bg-background"
          style={{ inset: 4 }}
        />

        {/* Logo — subtle breathe */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          style={{ inset: 8 }}
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <img
            src="/assets/logo-collapse.png"
            alt="Accident Payments"
            style={{ width: size - 16, height: size - 16, objectFit: "contain" }}
          />
        </motion.div>
      </div>

      {/* Optional label with fade loop */}
      {label && (
        <motion.span
          className="text-sm text-muted-foreground font-medium"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
        </motion.span>
      )}
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        {content}
      </div>
    );
  }

  if (page) {
    return (
      <div className="flex items-center justify-center w-full h-[calc(100vh-4rem)]">
        {content}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center w-full py-12">
      {content}
    </div>
  );
};

export default LogoLoader;
