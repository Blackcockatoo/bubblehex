import { ImageResponse } from "next/og";

export const socialImageSize = { width: 1200, height: 630 };

export function renderSocialImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(circle at 50% 30%, #0c2a52 0%, #050509 62%)",
          fontFamily: "Georgia, serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 28,
            marginBottom: 26,
          }}
        >
          <div
            style={{
              display: "flex",
              width: 74,
              height: 74,
              borderRadius: 18,
              border: "4px solid #087CFF",
              background: "rgba(8,124,255,0.12)",
            }}
          />
          <div style={{ display: "flex", color: "#68C4FF", fontSize: 26, letterSpacing: 6 }}>
            BLUE $NAKE STUDIO
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 130, color: "#C4133D", textShadow: "0 0 40px rgba(196,19,61,0.7)" }}>
          BUBBLE
        </div>
        <div style={{ display: "flex", fontSize: 150, color: "#20C98B", textShadow: "0 0 50px rgba(32,201,139,0.7)", marginTop: -20 }}>
          HEX
        </div>
        <div style={{ display: "flex", color: "#FFD6F1", fontSize: 26, letterSpacing: 4, marginTop: 22 }}>
          A GOTHIC BUBBLE-TRAPPING ARCADE ORIGINAL
        </div>
      </div>
    ),
    { ...socialImageSize },
  );
}
